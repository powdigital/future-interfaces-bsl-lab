import type { LearnedProfile, ResearcherProfile, TrainingExample } from "./types.ts";
import { createDefaultResearcherProfile, PRIMARY_RESEARCHER_ID } from "./research-profile.ts";
import { assertEvidencePolicy } from "./evidence-policy.ts";

const DATABASE_NAME = "future-interfaces-bsl";
const DATABASE_VERSION = 2;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("examples")) {
        const examples = database.createObjectStore("examples", { keyPath: "id", autoIncrement: true });
        examples.createIndex("signId", "signId", { unique: false });
      }
      if (!database.objectStoreNames.contains("profiles")) {
        database.createObjectStore("profiles", { keyPath: "signId" });
      }
      if (!database.objectStoreNames.contains("metadata")) {
        database.createObjectStore("metadata", { keyPath: "key" });
      }
    };
  });
}

export async function addExample(example: TrainingExample): Promise<number> {
  assertEvidencePolicy(example);
  const database = await openDatabase();
  const request = database.transaction("examples", "readwrite").objectStore("examples").add(example);
  const id = await requestResult(request);
  database.close();
  return Number(id);
}

export async function getExamples(signId: string): Promise<TrainingExample[]> {
  const database = await openDatabase();
  const request = database.transaction("examples", "readonly").objectStore("examples").index("signId").getAll(signId);
  const examples = await requestResult(request) as TrainingExample[];
  database.close();
  return examples;
}

export async function saveProfile(profile: LearnedProfile): Promise<void> {
  const database = await openDatabase();
  await requestResult(database.transaction("profiles", "readwrite").objectStore("profiles").put(profile));
  database.close();
}

export async function getAllProfiles(): Promise<LearnedProfile[]> {
  const database = await openDatabase();
  const profiles = await requestResult(database.transaction("profiles", "readonly").objectStore("profiles").getAll()) as LearnedProfile[];
  database.close();
  return profiles;
}

export async function getResearcherProfile(): Promise<ResearcherProfile> {
  const database = await openDatabase();
  const record = await requestResult(
    database.transaction("metadata", "readonly").objectStore("metadata").get("researcher-profile")
  ) as { key: string; value: ResearcherProfile } | undefined;
  database.close();
  if (record?.value) {
    if (record.value.dominantHand === "unknown" && record.value.signingHand === "unknown") {
      const migratedProfile: ResearcherProfile = {
        ...record.value,
        dominantHand: "right",
        signingHand: "right",
        updatedAt: new Date().toISOString()
      };
      await saveResearcherProfile(migratedProfile);
      return migratedProfile;
    }
    return record.value;
  }
  const profile = createDefaultResearcherProfile();
  await saveResearcherProfile(profile);
  return profile;
}

export async function saveResearcherProfile(profile: ResearcherProfile): Promise<void> {
  const database = await openDatabase();
  await requestResult(
    database.transaction("metadata", "readwrite").objectStore("metadata").put({
      key: "researcher-profile",
      value: { ...profile, id: PRIMARY_RESEARCHER_ID, updatedAt: new Date().toISOString() }
    })
  );
  database.close();
}

export async function clearSignTraining(signId: string): Promise<void> {
  const database = await openDatabase();
  const keys = await requestResult(database.transaction("examples", "readonly").objectStore("examples").index("signId").getAllKeys(signId));
  const transaction = database.transaction(["examples", "profiles"], "readwrite");
  keys.forEach((key) => transaction.objectStore("examples").delete(key));
  transaction.objectStore("profiles").delete(signId);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export interface TrainingExport {
  schemaVersion: 3;
  exportedAt: string;
  examples: TrainingExample[];
  profiles: LearnedProfile[];
  researcherProfile: ResearcherProfile;
}

interface LegacyTrainingExport {
  schemaVersion: 1 | 2;
  exportedAt: string;
  examples: TrainingExample[];
  profiles: LearnedProfile[];
  researcherProfile?: ResearcherProfile;
}

export async function exportTrainingData(): Promise<TrainingExport> {
  const database = await openDatabase();
  const transaction = database.transaction(["examples", "profiles"], "readonly");
  const examplesRequest = transaction.objectStore("examples").getAll();
  const profilesRequest = transaction.objectStore("profiles").getAll();
  const [examples, profiles] = await Promise.all([requestResult(examplesRequest), requestResult(profilesRequest)]);
  database.close();
  return {
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    examples: examples as TrainingExample[],
    profiles: profiles as LearnedProfile[],
    researcherProfile: await getResearcherProfile()
  };
}

export async function importTrainingData(data: TrainingExport | LegacyTrainingExport): Promise<void> {
  if (![1, 2, 3].includes(data?.schemaVersion) || !Array.isArray(data.examples) || !Array.isArray(data.profiles)) {
    throw new Error("Unsupported training data file");
  }
  const database = await openDatabase();
  const transaction = database.transaction(["examples", "profiles", "metadata"], "readwrite");
  data.examples.forEach((example) => {
    assertEvidencePolicy(example, data.schemaVersion < 3);
    const copy = { ...example };
    delete copy.id;
    transaction.objectStore("examples").add(copy);
  });
  data.profiles.forEach((profile) => transaction.objectStore("profiles").put(profile));
  if (data.schemaVersion >= 2 && "researcherProfile" in data && data.researcherProfile) {
    transaction.objectStore("metadata").put({ key: "researcher-profile", value: data.researcherProfile });
  }
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}
