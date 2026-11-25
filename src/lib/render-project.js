const { renderMarkdown, splitList } = require('./util');

/** Render a case-study page. Used by the public route and by the admin draft preview. */
module.exports = function renderProject(models, res, project, { preview = false } = {}) {
  res.render('project', {
    title: project.title,
    description: project.summary,
    project: { ...project, techList: splitList(project.tech), html: renderMarkdown(project.content) },
    images: models.projects.images(project.id),
    preview,
    ...(preview ? { prev: null, next: null } : models.projects.neighbours(project)),
    related: models.projects.related(project),
  });
};
