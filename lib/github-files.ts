const GITHUB_TOKEN = process.env.GITHUB_TOKEN_EMAIL_APP!;
const GITHUB_OWNER = process.env.GITHUB_OWNER || "aolagunju-cre";
const GITHUB_REPO = process.env.GITHUB_REPO || "email-drafts-app";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "master";
const BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

interface GHItem {
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
  content?: string;
}

async function ghFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

export async function listDir(path: string): Promise<GHItem[]> {
  try {
    return await ghFetch<GHItem[]>(`/contents/${path}?ref=${GITHUB_BRANCH}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return [];
    throw err;
  }
}

export async function readGHFile(path: string): Promise<{ content: string; sha: string }> {
  const data = await ghFetch<GHItem>(`/contents/${path}?ref=${GITHUB_BRANCH}`);
  return {
    content: Buffer.from(data.content || "", "base64").toString("utf-8"),
    sha: data.sha,
  };
}

export async function writeGHFile(
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<void> {
  await ghFetch(`/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString("base64"),
      branch: GITHUB_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
}
