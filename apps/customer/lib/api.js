export async function api(
  path,
  data,
  method = data === undefined ? "GET" : "POST",
) {
  let response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Zetmond-Request": "1" },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
  } catch {
    throw new Error(
      "Cannot connect right now. Check your connection and try again.",
    );
  }
  const body = await response
    .json()
    .catch(() => ({ message: "Service unavailable. Please try again." }));
  if (!response.ok) {
    const error = new Error(body.message || "Unable to complete this request.");
    error.fields = body.fields;
    error.status = response.status;
    throw error;
  }
  return body;
}
