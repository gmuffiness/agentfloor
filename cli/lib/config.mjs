/**
 * Global (~/.agent-factorio/config.json) and local (.agent-factorio/config.json) config management
 */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const GLOBAL_DIR = path.join(os.homedir(), ".agent-factorio");
const GLOBAL_CONFIG = path.join(GLOBAL_DIR, "config.json");
const LOCAL_DIR_NAME = ".agent-factorio";
const LOCAL_CONFIG_NAME = "config.json";

// --- Global config ---

/**
 * @typedef {{ hubUrl: string, orgId: string, orgName: string, inviteCode: string, memberName?: string, email?: string, memberId?: string, userId?: string, authToken?: string }} OrgEntry
 * @typedef {{ organizations: OrgEntry[], defaultOrg?: string }} GlobalConfig
 */

/** @returns {GlobalConfig | null} */
export function readGlobalConfig() {
  try {
    const raw = fs.readFileSync(GLOBAL_CONFIG, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @param {GlobalConfig} config */
export function writeGlobalConfig(config) {
  fs.mkdirSync(GLOBAL_DIR, { recursive: true });
  fs.writeFileSync(GLOBAL_CONFIG, JSON.stringify(config, null, 2) + "\n");
}

export function deleteGlobalConfig() {
  try {
    fs.unlinkSync(GLOBAL_CONFIG);
  } catch {
    // ignore if not exists
  }
}

/**
 * Get the default (or only) organization from global config
 * @returns {OrgEntry | null}
 */
export function getDefaultOrg() {
  const config = readGlobalConfig();
  if (!config || !config.organizations?.length) return null;

  if (config.defaultOrg) {
    const found = config.organizations.find((o) => o.orgId === config.defaultOrg);
    if (found) return found;
  }
  return config.organizations[0];
}

/**
 * Add or update an organization in global config
 * @param {OrgEntry} org
 */
export function upsertOrg(org, { setAsDefault = false } = {}) {
  const config = readGlobalConfig() || { organizations: [] };
  const idx = config.organizations.findIndex(
    (o) => o.orgId === org.orgId && o.hubUrl === org.hubUrl
  );
  if (idx >= 0) {
    config.organizations[idx] = org;
  } else {
    config.organizations.push(org);
  }
  if (!config.defaultOrg || setAsDefault) {
    config.defaultOrg = org.orgId;
  }
  writeGlobalConfig(config);
}

// --- Local (project) config ---

/**
 * @typedef {{ hubUrl: string, orgId: string, agentId: string, agentName: string, vendor: string, model: string, pushedAt: string }} LocalConfig
 */

/**
 * Find project root by looking for .git directory
 * @param {string} [startDir]
 * @returns {string}
 */
export function findProjectRoot(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

/** @param {string} [projectRoot] @returns {LocalConfig | null} */
export function readLocalConfig(projectRoot) {
  const root = projectRoot || findProjectRoot();
  const configPath = path.join(root, LOCAL_DIR_NAME, LOCAL_CONFIG_NAME);
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @param {LocalConfig} config @param {string} [projectRoot] */
export function writeLocalConfig(config, projectRoot) {
  const root = projectRoot || findProjectRoot();
  const dir = path.join(root, LOCAL_DIR_NAME);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, LOCAL_CONFIG_NAME),
    JSON.stringify(config, null, 2) + "\n"
  );
}

export { GLOBAL_CONFIG };
