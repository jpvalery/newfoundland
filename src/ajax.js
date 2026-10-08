export default async function get(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`)
  }
  return response.text()
}
