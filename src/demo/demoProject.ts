/** Demo project with fictional data (completed in milestone 8). */
import { createProject, type ExpertIdentity, type Id, type Project } from '../core';

export function buildDemoProject(): { project: Project; identities: Record<Id, ExpertIdentity> } {
  return { project: createProject('پروژه نمونه (داده ساختگی)'), identities: {} };
}
