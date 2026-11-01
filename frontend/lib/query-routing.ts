/** Route unmistakable personal GitHub PR requests to the connected GitHub source. */
export function requestedConnectedSource(question: string): 'github' | null {
  const query = question.toLowerCase();
  const personalPullRequest = /\b(?:my|mine)\b.{0,40}\b(?:pull\s*requests?|prs?)\b|\b(?:pull\s*requests?|prs?)\b.{0,40}\b(?:from|in|on)\s+my\s+github\b/;
  const explicitGitHubPullRequest = /\bgithub\b.{0,40}\b(?:pull\s*requests?|prs?)\b|\b(?:pull\s*requests?|prs?)\b.{0,40}\bgithub\b/;
  return personalPullRequest.test(query) || explicitGitHubPullRequest.test(query) ? 'github' : null;
}
