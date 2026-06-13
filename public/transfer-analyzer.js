/**
 * FPL Transfer Analyzer
 * Analyzes team for transfer recommendations and starting XI suggestions
 * Enforces FPL squad rules: 2 GK, 5 DEF, 5 MID, 3 FWD, max 100m budget
 */

const TransferAnalyzer = (() => {
  // ── Constants ──────────────────────────────────────────────
  const SQUAD_RULES = {
    GKP: { required: 2, playing: 1 },
    DEF: { required: 5, playing: 4 },
    MID: { required: 5, playing: 5 },
    FWD: { required: 3, playing: 3 }
  };
  const MAX_BUDGET = 100.0;
  const MAX_SQUAD_SIZE = 15;

  // ── Performance Scoring ────────────────────────────────────
  /**
   * Calculate a player's form score based on multiple factors
   * Considers: form, total_points, goals, assists, clean_sheets, yellow_cards, injuries
   */
  function calculatePlayerScore(player) {
    let score = 0;
    const weights = {
      form: 0.30,
      recent_points: 0.25,
      goals: 0.15,
      assists: 0.10,
      clean_sheets: 0.10,
      yellow_cards: -0.05,
      injury_risk: -0.05
    };

    // Form (0-100)
    const formScore = parseFloat(player.form || 0) * 10;
    score += formScore * weights.form;

    // Recent points (GW points)
    const recentPoints = parseFloat(player.event_points || 0) * 10;
    score += recentPoints * weights.recent_points;

    // Goals (weighted by position)
    let goalWeight = 0.5;
    if (player.element_type === 4) goalWeight = 1.0; // FWD
    if (player.element_type === 3) goalWeight = 0.7; // MID
    score += (player.goals_scored || 0) * goalWeight * weights.goals;

    // Assists
    score += (player.assists || 0) * weights.assists;

    // Clean sheets
    const csPoints = player.element_type <= 2 ? (player.clean_sheets || 0) * 2 : 0;
    score += csPoints * weights.clean_sheets;

    // Yellow cards (negative impact)
    score += (player.yellow_cards || 0) * weights.yellow_cards;

    // Injury risk
    if (player.status === 'u') score += -5; // Unavailable
    if (player.status === 'd') score += -3; // Doubt
    if (player.status === 's') score += -1; // Suspended

    return Math.max(0, score);
  }

  /**
   * Validate squad composition against FPL rules
   */
  function validateSquad(players) {
    const errors = [];
    const warnings = [];
    const composition = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
    let totalCost = 0;

    players.forEach(p => {
      const pos = getPositionName(p.element_type);
      composition[pos]++;
      totalCost += p.now_cost || 0;
    });

    // Check required positions
    Object.entries(SQUAD_RULES).forEach(([pos, rules]) => {
      if (composition[pos] < rules.required) {
        errors.push(`Missing ${pos}: have ${composition[pos]}, need ${rules.required}`);
      }
      if (composition[pos] > rules.required) {
        errors.push(`Too many ${pos}: have ${composition[pos]}, max ${rules.required}`);
      }
    });

    // Check budget
    const budgetInMillions = totalCost / 10;
    if (budgetInMillions > MAX_BUDGET) {
      errors.push(`Squad cost £${budgetInMillions.toFixed(1)}m exceeds £${MAX_BUDGET}m budget`);
    }

    // Check squad size
    if (players.length !== MAX_SQUAD_SIZE) {
      errors.push(`Squad size is ${players.length}, must be exactly ${MAX_SQUAD_SIZE}`);
    }

    return { isValid: errors.length === 0, errors, warnings, composition, totalCost };
  }

  /**
   * Suggest transfers to fix squad issues
   * Rules: Can only exchange same position for same position
   */
  function suggestTransfers(squad, allPlayers) {
    const validation = validateSquad(squad);
    const suggestions = [];

    if (validation.isValid) {
      return { suggestions: [], message: '✅ Squad is valid!' };
    }

    const compositions = validation.composition;
    const allPlayersByPos = {};

    // Group all players by position
    allPlayers.forEach(p => {
      const pos = getPositionName(p.element_type);
      if (!allPlayersByPos[pos]) allPlayersByPos[pos] = [];
      allPlayersByPos[pos].push(p);
    });

    // Sort by score descending
    Object.keys(allPlayersByPos).forEach(pos => {
      allPlayersByPos[pos].sort((a, b) => calculatePlayerScore(b) - calculatePlayerScore(a));
    });

    // Identify weak positions
    const squadByPos = {};
    squad.forEach(p => {
      const pos = getPositionName(p.element_type);
      if (!squadByPos[pos]) squadByPos[pos] = [];
      squadByPos[pos].push(p);
    });

    // Sort squad players by score
    Object.keys(squadByPos).forEach(pos => {
      squadByPos[pos].sort((a, b) => calculatePlayerScore(a) - calculatePlayerScore(b));
    });

    // Generate transfer suggestions
    Object.entries(SQUAD_RULES).forEach(([pos, rules]) => {
      const have = compositions[pos] || 0;

      if (have > rules.required) {
        // Too many of this position - suggest selling
        const excess = have - rules.required;
        for (let i = 0; i < excess; i++) {
          const playerToSell = squadByPos[pos][i];
          if (playerToSell) {
            const recommendations = allPlayersByPos[pos]
              .filter(p => !squad.find(sp => sp.id === p.id) && p.status === 'a')
              .slice(0, 3);

            recommendations.forEach(rec => {
              const priceDiff = (rec.now_cost - playerToSell.now_cost) / 10;
              suggestions.push({
                type: 'sell',
                sell: playerToSell,
                buy: rec,
                position: pos,
                priceDiff,
                scoreDiff: calculatePlayerScore(rec) - calculatePlayerScore(playerToSell),
                reason: `Upgrade ${playerToSell.web_name} (${calculatePlayerScore(playerToSell).toFixed(1)}) to ${rec.web_name} (${calculatePlayerScore(rec).toFixed(1)})`
              });
            });
          }
        }
      } else if (have < rules.required) {
        // Too few of this position - suggest buying
        const needed = rules.required - have;
        for (let i = 0; i < needed; i++) {
          const topAvailable = allPlayersByPos[pos]
            .filter(p => !squad.find(sp => sp.id === p.id) && p.status === 'a')
            .slice(0, 1)[0];

          if (topAvailable) {
            suggestions.push({
              type: 'buy',
              buy: topAvailable,
              position: pos,
              reason: `Buy ${topAvailable.web_name} to fulfill ${pos} requirement`
            });
          }
        }
      }
    });

    return { suggestions, composition: validation.composition };
  }

  /**
   * Create optimal starting XI and bench from current squad
   * Based on form score
   */
  function generateLineup(squad, currentGameWeek = null) {
    // Score all players
    const scoredPlayers = squad.map(p => ({
      ...p,
      score: calculatePlayerScore(p),
      fixture_difficulty: p.fixtures ? getAverageFixtureDifficulty(p.fixtures) : 2
    }));

    const lineup = { starting: [], bench: [] };
    const byPosition = {};

    // Group by position
    scoredPlayers.forEach(p => {
      const pos = getPositionName(p.element_type);
      if (!byPosition[pos]) byPosition[pos] = [];
      byPosition[pos].push(p);
    });

    // Sort each position by score
    Object.keys(byPosition).forEach(pos => {
      byPosition[pos].sort((a, b) => b.score - a.score);
    });

    // Build starting XI (1 GKP, 4 DEF, 5 MID, 3 FWD)
    const starters = [
      ...byPosition.GKP.slice(0, 1),
      ...byPosition.DEF.slice(0, 4),
      ...byPosition.MID.slice(0, 5),
      ...byPosition.FWD.slice(0, 3)
    ];

    // Remaining players go to bench
    const benched = [
      ...byPosition.GKP.slice(1),
      ...byPosition.DEF.slice(4),
      ...byPosition.MID.slice(5),
      ...byPosition.FWD.slice(3)
    ];

    return {
      starting: starters.sort((a, b) => b.score - a.score),
      bench: benched.sort((a, b) => b.score - a.score),
      stats: {
        totalStarterScore: starters.reduce((sum, p) => sum + p.score, 0),
        totalBenchScore: benched.reduce((sum, p) => sum + p.score, 0),
        avgFixtureDifficulty: starters.reduce((sum, p) => sum + p.fixture_difficulty, 0) / starters.length
      }
    };
  }

  /**
   * Analyze a manager's team and provide comprehensive recommendations
   */
  async function analyzeTeam(managerId, picks, allPlayers, allTeams) {
    const squad = picks.map(pick => {
      const player = allPlayers.find(p => p.id === pick.element);
      return {
        ...player,
        ...pick,
        id: player.id,
        web_name: player.web_name,
        element_type: player.element_type,
        now_cost: player.now_cost,
        form: player.form,
        goals_scored: player.goals_scored,
        assists: player.assists,
        clean_sheets: player.clean_sheets,
        yellow_cards: player.yellow_cards,
        status: player.status
      };
    });

    const validation = validateSquad(squad);
    const lineup = generateLineup(squad);
    const transfers = suggestTransfers(squad, allPlayers);

    return {
      squad,
      validation,
      lineup,
      transfers,
      squad_value: validation.totalCost / 10,
      bank: (Math.round(managerId * 1000 + 1000) % 10) / 10, // Simulated bank (in real app, get from API)
      analysis: {
        isOptimized: validation.isValid && lineup.stats.totalStarterScore > 0,
        strengths: identifyStrengths(squad),
        weaknesses: identifyWeaknesses(squad, allPlayers),
        recommendations: generateRecommendations(squad, lineup, allPlayers)
      }
    };
  }

  /**
   * Identify squad strengths
   */
  function identifyStrengths(squad) {
    const strengths = [];
    const scoredSquad = squad.map(p => ({ ...p, score: calculatePlayerScore(p) }));
    const avgScore = scoredSquad.reduce((sum, p) => sum + p.score, 0) / scoredSquad.length;

    const topPlayers = scoredSquad
      .filter(p => p.score > avgScore * 1.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    topPlayers.forEach(p => {
      strengths.push({
        player: p.web_name,
        reason: `Excellent form (score: ${p.score.toFixed(1)})`,
        score: p.score
      });
    });

    return strengths;
  }

  /**
   * Identify squad weaknesses
   */
  function identifyWeaknesses(squad, allPlayers) {
    const weaknesses = [];
    const scoredSquad = squad.map(p => ({ ...p, score: calculatePlayerScore(p) }));
    const avgScore = scoredSquad.reduce((sum, p) => sum + p.score, 0) / scoredSquad.length;

    const poorPlayers = scoredSquad
      .filter(p => p.score < avgScore * 0.7)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);

    poorPlayers.forEach(p => {
      const pos = getPositionName(p.element_type);
      const betterAlternative = allPlayers
        .filter(alt => alt.element_type === p.element_type && alt.status === 'a')
        .sort((a, b) => calculatePlayerScore(b) - calculatePlayerScore(a))[0];

      weaknesses.push({
        player: p.web_name,
        reason: `Poor form (score: ${p.score.toFixed(1)})`,
        upgrade: betterAlternative ? betterAlternative.web_name : 'N/A',
        score: p.score
      });
    });

    return weaknesses;
  }

  /**
   * Generate actionable recommendations
   */
  function generateRecommendations(squad, lineup, allPlayers) {
    const recommendations = [];

    // Check if bench players should be starting
    lineup.bench.forEach((p, idx) => {
      if (lineup.starting.length > 0 && p.score > lineup.starting[lineup.starting.length - 1].score) {
        recommendations.push({
          priority: 'high',
          type: 'lineup',
          suggestion: `Start ${p.web_name} (${p.score.toFixed(1)}) instead of ${lineup.starting[lineup.starting.length - 1].web_name}`,
          impact: '+' + (p.score - lineup.starting[lineup.starting.length - 1].score).toFixed(1) + ' points'
        });
      }
    });

    // Suggest captain pick
    const topPriority = lineup.starting.reduce((prev, p) => 
      calculatePlayerScore(p) > calculatePlayerScore(prev) ? p : prev
    );
    recommendations.push({
      priority: 'high',
      type: 'captain',
      suggestion: `Consider ${topPriority.web_name} as captain (Form: ${topPriority.form}, Recent GW: ${topPriority.event_points}pts)`
    });

    return recommendations;
  }

  /**
   * Helper: Get position name from element_type
   */
  function getPositionName(elementType) {
    return { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }[elementType] || 'UNK';
  }

  /**
   * Helper: Calculate average fixture difficulty from fixtures
   */
  function getAverageFixtureDifficulty(fixtures) {
    if (!fixtures || fixtures.length === 0) return 2;
    const difficulty = fixtures.slice(0, 3).reduce((sum, f) => sum + (f.difficulty || 2), 0);
    return difficulty / Math.min(3, fixtures.length);
  }

  // ── Public API ────────────────────────────────────────────
  return {
    analyzeTeam,
    validateSquad,
    suggestTransfers,
    generateLineup,
    calculatePlayerScore,
    getPositionName,
    SQUAD_RULES,
    MAX_BUDGET
  };
})();

// Export for Node.js if applicable
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TransferAnalyzer;
}
