const { getFirebaseClientConfig } = require("./config/firebaseClientConfig");

function getRequiredConfig() {
  const config = getFirebaseClientConfig();

  if (!config.apiKey || !config.projectId) {
    throw new Error(
      "Missing Firebase web config. Expected VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID.",
    );
  }

  return config;
}

function getFirestoreDocumentUrl(documentPath) {
  const { projectId } = getRequiredConfig();
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath}`;
}

function getIdentityLookupUrl() {
  const { apiKey } = getRequiredConfig();
  return `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item)),
      },
    };
  }

  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nestedValue]) => [
            key,
            toFirestoreValue(nestedValue),
          ]),
        ),
      },
    };
  }

  if (typeof value === "string") {
    return { stringValue: value };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }

  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

function fromFirestoreValue(value) {
  if ("nullValue" in value) {
    return null;
  }

  if ("stringValue" in value) {
    return value.stringValue;
  }

  if ("booleanValue" in value) {
    return value.booleanValue;
  }

  if ("integerValue" in value) {
    return Number(value.integerValue);
  }

  if ("doubleValue" in value) {
    return value.doubleValue;
  }

  if ("arrayValue" in value) {
    return (value.arrayValue.values ?? []).map((item) =>
      fromFirestoreValue(item),
    );
  }

  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields ?? {}).map(([key, nestedValue]) => [
        key,
        fromFirestoreValue(nestedValue),
      ]),
    );
  }

  return null;
}

function documentToPlainObject(document) {
  return Object.fromEntries(
    Object.entries(document.fields ?? {}).map(([key, value]) => [
      key,
      fromFirestoreValue(value),
    ]),
  );
}

function buildDocumentBody(data) {
  return {
    fields: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        toFirestoreValue(value),
      ]),
    ),
  };
}

async function verifyIdTokenWithRest(idToken) {
  const response = await fetch(getIdentityLookupUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idToken,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (
    !response.ok ||
    !Array.isArray(payload.users) ||
    payload.users.length === 0
  ) {
    throw new Error("Invalid or expired session.");
  }

  const user = payload.users[0];

  return {
    uid: user.localId,
    email: user.email ?? null,
    name: user.displayName ?? null,
    picture: user.photoUrl ?? null,
  };
}

async function getDocument(documentPath, idToken) {
  const response = await fetch(getFirestoreDocumentUrl(documentPath), {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to load Firestore document.");
  }

  const payload = await response.json();
  return documentToPlainObject(payload);
}

async function setDocument(documentPath, idToken, data) {
  const topLevelFields = Object.keys(data);
  const updateMask = topLevelFields
    .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join("&");
  const separator = updateMask ? `?${updateMask}` : "";
  const response = await fetch(
    `${getFirestoreDocumentUrl(documentPath)}${separator}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildDocumentBody(data)),
    },
  );

  if (!response.ok) {
    throw new Error("Unable to save Firestore document.");
  }
}

module.exports = {
  getFirebaseClientConfig,
  getDocument,
  setDocument,
  verifyIdTokenWithRest,
};
