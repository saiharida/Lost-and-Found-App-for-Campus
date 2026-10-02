// Calculate keyword similarity using Jaccard index
function computeTextSimilarity(textA = '', textB = '') {
  const stopWords = new Set([
    'the', 'a', 'an', 'in', 'on', 'at', 'with', 'and', 'or', 'of', 'for', 'is', 'it', 'my', 'to', 'was'
  ]);

  const tokenize = (str) =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

  const setA = new Set(tokenize(textA));
  const setB = new Set(tokenize(textB));

  if (setA.size === 0 || setB.size === 0) return 0;

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

// Calculate rule-based match score between two items (0 to 100)
function calculateMatchScore(sourceItem, candidateItem) {
  let score = 0;

  // 1. Category Match (35 points)
  if (
    sourceItem.category &&
    candidateItem.category &&
    sourceItem.category.trim().toLowerCase() === candidateItem.category.trim().toLowerCase()
  ) {
    score += 35;
  }

  // 2. Location Proximity (25 points)
  if (sourceItem.location && candidateItem.location) {
    const locA = sourceItem.location.trim().toLowerCase();
    const locB = candidateItem.location.trim().toLowerCase();
    if (locA === locB) {
      score += 25;
    } else if (locA.includes(locB) || locB.includes(locA)) {
      score += 18;
    }
  }

  // 3. Keyword / Text Similarity (25 points)
  const sourceText = `${sourceItem.title} ${sourceItem.description || ''}`;
  const candidateText = `${candidateItem.title} ${candidateItem.description || ''}`;
  const textSim = computeTextSimilarity(sourceText, candidateText);
  score += Math.round(textSim * 25);

  // 4. Date Proximity (15 points)
  if (sourceItem.dateOccurred && candidateItem.dateOccurred) {
    const diffTime = Math.abs(new Date(sourceItem.dateOccurred) - new Date(candidateItem.dateOccurred));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 3) {
      score += 15;
    } else if (diffDays <= 7) {
      score += 10;
    } else if (diffDays <= 14) {
      score += 5;
    }
  }

  return Math.min(score, 100);
}

module.exports = { calculateMatchScore };