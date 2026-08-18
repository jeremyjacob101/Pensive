const SITE_URL_ARGUMENT = 'process.argv.indexOf("--site-url-file")';
const LEGACY_HTTP_REQUEST = "fetch(`${baseUrl}${path}`";
const LEGACY_CONVEX_CLIENT = "new ConvexHttpClient(baseUrl)";
const LEGACY_REQUIRED_MARKERS = [
  'process.argv.indexOf("--url-file")',
  'process.argv.indexOf("--credentials-file")',
  'request("/api/auth/sign-in"',
  'process.env.COMPAT_KEEP_DATA === "true"',
];

function countOccurrences(source, value) {
  return source.split(value).length - 1;
}

// The first promotion after introducing separate cloud/site URLs still compares
// against a main revision whose contract runner only knew one URL. Preserve that
// revision's contracts while adapting only its HTTP transport.
export function adaptLegacyCompatibilityScript(source) {
  if (source.includes(SITE_URL_ARGUMENT)) {
    return { adapted: false, source };
  }

  const missingMarkers = LEGACY_REQUIRED_MARKERS.filter(
    (marker) => !source.includes(marker),
  );
  const httpRequestCount = countOccurrences(source, LEGACY_HTTP_REQUEST);
  const convexClientCount = countOccurrences(source, LEGACY_CONVEX_CLIENT);

  if (
    missingMarkers.length > 0 ||
    httpRequestCount !== 1 ||
    convexClientCount !== 1
  ) {
    throw new Error(
      [
        "Cannot safely adapt the previous compatibility runner.",
        missingMarkers.length > 0
          ? `Missing markers: ${missingMarkers.join(", ")}.`
          : null,
        `Legacy HTTP request matches: ${httpRequestCount}.`,
        `Legacy Convex client matches: ${convexClientCount}.`,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  return {
    adapted: true,
    source: source.replace(
      LEGACY_HTTP_REQUEST,
      "fetch(`${process.env.COMPAT_CONVEX_SITE_URL}${path}`",
    ),
  };
}
