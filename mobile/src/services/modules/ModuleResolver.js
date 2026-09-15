/**
 * Module Resolver — Phase 5 (Moodle Addon-Style Handler Registry)
 * Inspired by ModuleHandlerFactory pattern in moodlehq/moodleapp.
 *
 * Each module type has a dedicated handler that knows how to:
 *   - Get the content source for the WebView
 *   - Get the navigation target screen
 *   - Declare whether it can be viewed in-app
 */

// Handler for SCORM interactive packages
const ScormHandler = {
  canViewInApp: () => true,
  getNavigationTarget: (module) => ({
    screen: 'CourseContentViewer',
    params: { module },
  }),
  getTypeLabel: () => 'Interactive',
  getIconName: () => 'play-circle',
  getIconColor: () => '#00AEEF',
  getIconBg: () => 'rgba(0,174,239,0.13)',
};

// Handler for HTML lesson pages
const PageHandler = {
  canViewInApp: () => true,
  getNavigationTarget: (module) => ({
    screen: 'CourseContentViewer',
    params: { module },
  }),
  getTypeLabel: () => 'Lesson',
  getIconName: () => 'book-open',
  getIconColor: () => '#00AEEF',
  getIconBg: () => 'rgba(0,174,239,0.13)',
};

// Handler for Book modules
const BookHandler = {
  canViewInApp: () => true,
  getNavigationTarget: (module) => ({
    screen: 'CourseContentViewer',
    params: { module },
  }),
  getTypeLabel: () => 'Book',
  getIconName: () => 'book-open',
  getIconColor: () => '#00AEEF',
  getIconBg: () => 'rgba(0,174,239,0.13)',
};

// Handler for PDF/Resource files
const ResourceHandler = {
  canViewInApp: (module) => {
    const mime = module?.mimetype || '';
    return mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('video/') || mime.startsWith('audio/');
  },
  getNavigationTarget: (module) => ({
    screen: 'CourseContentViewer',
    params: { module },
  }),
  getTypeLabel: (module) => {
    if (module?.isPdf) return 'PDF';
    if (module?.mimetype?.startsWith('video/')) return 'Video';
    if (module?.mimetype?.startsWith('audio/')) return 'Audio';
    return 'Resource';
  },
  getIconName: (module) => {
    if (module?.isPdf) return 'file-text';
    if (module?.mimetype?.startsWith('video/')) return 'play-circle';
    if (module?.mimetype?.startsWith('audio/')) return 'headphones';
    return 'file';
  },
  getIconColor: (module) => {
    if (module?.isPdf) return '#EF4444';
    if (module?.mimetype?.startsWith('video/')) return '#F59E0B';
    return '#3B82F6';
  },
  getIconBg: (module) => {
    if (module?.isPdf) return 'rgba(239,68,68,0.13)';
    if (module?.mimetype?.startsWith('video/')) return 'rgba(245,158,11,0.13)';
    return 'rgba(59,130,246,0.13)';
  },
};

// Handler for external URLs
const UrlHandler = {
  canViewInApp: () => true,
  getNavigationTarget: (module) => ({
    screen: 'CourseContentViewer',
    params: { module },
  }),
  getTypeLabel: () => 'Link',
  getIconName: () => 'globe',
  getIconColor: () => '#8B5CF6',
  getIconBg: () => 'rgba(139,92,246,0.13)',
};

// Handler for Quizzes
const QuizHandler = {
  canViewInApp: () => true,
  getNavigationTarget: (module) => ({
    screen: 'QuizPlayer',
    params: { quizId: module.quizId || module.instance, courseId: module.courseId },
  }),
  getTypeLabel: () => 'Quiz',
  getIconName: () => 'help-circle',
  getIconColor: () => '#10B981',
  getIconBg: () => 'rgba(16,185,129,0.13)',
};

// Handler for Assignments
const AssignmentHandler = {
  canViewInApp: () => true,
  getNavigationTarget: (module) => ({
    screen: 'AssignmentView',
    params: { assignId: module.assignId || module.instance, courseId: module.courseId },
  }),
  getTypeLabel: () => 'Assignment',
  getIconName: () => 'edit-3',
  getIconColor: () => '#F97316',
  getIconBg: () => 'rgba(249,115,22,0.13)',
};

// Handler for Forums
const ForumHandler = {
  canViewInApp: () => true,
  getNavigationTarget: (module) => ({
    screen: 'ForumScreen',
    params: { forumId: module.forumId || module.instance, courseId: module.courseId },
  }),
  getTypeLabel: () => 'Forum',
  getIconName: () => 'message-square',
  getIconColor: () => '#6366F1',
  getIconBg: () => 'rgba(99,102,241,0.13)',
};

// Handler for Certificates
const CertificateHandler = {
  canViewInApp: () => true,
  getNavigationTarget: (module) => ({
    screen: 'CourseContentViewer',
    params: { module },
  }),
  getTypeLabel: () => 'Certificate',
  getIconName: () => 'award',
  getIconColor: () => '#10B981',
  getIconBg: () => 'rgba(16,185,129,0.13)',
};

// Default fallback handler
const DefaultHandler = {
  canViewInApp: () => true,
  getNavigationTarget: (module) => ({
    screen: 'CourseContentViewer',
    params: { module },
  }),
  getTypeLabel: () => 'Material',
  getIconName: () => 'book-open',
  getIconColor: () => '#64748B',
  getIconBg: () => 'rgba(100,116,139,0.13)',
};

// Registry mapping Moodle module names to their handlers
const HANDLER_REGISTRY = {
  scorm:             ScormHandler,
  page:              PageHandler,
  book:              BookHandler,
  resource:          ResourceHandler,
  url:               UrlHandler,
  quiz:              QuizHandler,
  assign:            AssignmentHandler,
  forum:             ForumHandler,
  customcert:        CertificateHandler,
  certificate:       CertificateHandler,
  simplecertificate: CertificateHandler,
};

/**
 * Resolve the appropriate handler for a given Moodle module.
 */
export function resolveModuleHandler(module) {
  if (!module) return DefaultHandler;

  // PDF check overrides resource handler label/icon
  if (module.isPdf) {
    return ResourceHandler;
  }

  return HANDLER_REGISTRY[module.modname] || DefaultHandler;
}

/**
 * Get the navigation target for a module (screen name + params).
 * Used in CourseDetailScreen to route module taps correctly.
 */
export function getModuleNavigationTarget(module, courseId) {
  const handler = resolveModuleHandler(module);
  const target = handler.getNavigationTarget({ ...module, courseId });
  return target;
}

/**
 * Get display metadata (label, icon name, colors) for a module.
 * Used in CourseDetailScreen to render module cards.
 */
export function getModuleDisplayMeta(module) {
  const handler = resolveModuleHandler(module);
  return {
    label:   typeof handler.getTypeLabel === 'function' ? handler.getTypeLabel(module) : 'Material',
    color:   typeof handler.getIconColor === 'function' ? handler.getIconColor(module) : '#64748B',
    bg:      typeof handler.getIconBg    === 'function' ? handler.getIconBg(module)    : 'rgba(100,116,139,0.13)',
  };
}

export const ModuleResolver = {
  getHandler: resolveModuleHandler,
  resolveModuleHandler,
  getModuleNavigationTarget,
  getModuleDisplayMeta,
};
