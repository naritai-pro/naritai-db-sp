export function questionPath(id: string) {
  const parts = /^(\d{4})-autumn-db-(pm[12])-(q\d+)$/.exec(id);
  if (!parts) throw new Error("Invalid question ID: " + id);
  return "/" + parts.slice(1).join("/");
}

export function resolveRoute() {
  const legacy = /^#\/(solve|review|paper)\/(\d{4}-autumn-db-pm[12]-q\d+)(\?.*)?$/.exec(location.hash);
  if (legacy) {
    const suffix = legacy[1] === "review" ? "/answer" : "";
    history.replaceState(null, "", questionPath(legacy[2]) + suffix + (legacy[3] ?? ""));
  } else if (location.hash === "#/") {
    history.replaceState(null, "", "/");
  }
  const match = /^\/(\d{4})\/(pm[12])\/(q\d+)(\/answer)?\/?$/.exec(location.pathname);
  return {
    id: match ? [match[1], "autumn-db", match[2], match[3]].join("-") : "",
    reviewing: !!match?.[4],
  };
}
