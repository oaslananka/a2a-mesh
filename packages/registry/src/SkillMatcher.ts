/**
 * @file SkillMatcher.ts
 * Semantic skill matcher (fallback to tags/substring for now).
 */

import type { RegisteredAgent } from './storage/IAgentStorage.js';

export interface SkillMatcherQuery {
  skill?: string;
  tag?: string;
  name?: string;
}

export class SkillMatcher {
  /**
   * Filters agents based on a skill keyword or tag.
   * @param agents All registered agents.
   * @param query Search query values.
   * @returns Array of matched agents.
   */
  static match(agents: RegisteredAgent[], query: SkillMatcherQuery): RegisteredAgent[] {
    const skill = query.skill?.toLowerCase();
    const tag = query.tag?.toLowerCase();
    const name = query.name?.toLowerCase();

    return agents.filter((agent) => {
      if (name && !agent.card.name.toLowerCase().includes(name)) {
        return false;
      }

      const { skills } = agent.card;
      if ((!skills || skills.length === 0) && (skill || tag)) {
        return false;
      }

      if (!skills || skills.length === 0) {
        return true;
      }

      return skills.some((entry) => {
        if (skill && entry.name.toLowerCase().includes(skill)) return true;
        if (skill && entry.description.toLowerCase().includes(skill)) return true;
        if (tag && entry.tags && entry.tags.some((value) => value.toLowerCase().includes(tag))) return true;
        if (!skill && !tag) return true;
        return false;
      });
    });
  }
}
