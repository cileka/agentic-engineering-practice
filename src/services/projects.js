const projectsQueries = require('../db/queries/projects');
const { isNonEmptyString } = require('../utils/validation');
const { httpError } = require('../utils/http-error');

function listProjects() {
  return projectsQueries.listProjects();
}

function getProjectStats(projectId) {
  const stats = { total: 0, active: 0, completed: 0, archived: 0 };
  for (const row of projectsQueries.countTasksByStatus(projectId)) {
    stats[row.status] = row.count;
    stats.total += row.count;
  }
  return stats;
}

function getProjectWithStats(id) {
  const projectId = parseInt(id);
  const project = projectsQueries.findProjectById(projectId);
  if (!project) return null;
  return { ...project, stats: getProjectStats(projectId) };
}

function createProject({ name, description, owner_id }) {
  if (!isNonEmptyString(name)) throw httpError(400, 'name is required');
  const result = projectsQueries.insertProject(name, description || null, owner_id || null);
  return projectsQueries.findProjectById(result.lastInsertRowid);
}

function updateProject(id, data) {
  const projectId = parseInt(id);
  const existing = projectsQueries.findProjectById(projectId);
  if (!existing) throw httpError(404, 'Project not found');

  const name = data.name !== undefined ? data.name : existing.name;
  const description = data.description !== undefined ? data.description : existing.description;
  const ownerId = data.owner_id !== undefined ? data.owner_id : existing.owner_id;

  projectsQueries.updateProject(projectId, name, description, ownerId);
  return projectsQueries.findProjectById(projectId);
}

function deleteProject(id) {
  const result = projectsQueries.deleteProject(parseInt(id));
  if (result.changes === 0) throw httpError(404, 'Project not found');
  return { deleted: true };
}

module.exports = { listProjects, getProjectWithStats, createProject, updateProject, deleteProject };
