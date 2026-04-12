"""
Cadence Skill Registry — Middleware that auto-discovers and loads skills.

Each skill lives in its own subdirectory and exposes a MANIFEST variable
of type SkillManifest. This loader scans all subdirectories, imports the
manifest, and builds a unified registry for the chat agent router.
"""
import os
import importlib
from typing import Dict, List, Any, Optional
from skills.base import SkillManifest


class SkillRegistry:
    """Singleton registry of all available Cadence skills."""

    def __init__(self):
        self._skills: Dict[str, SkillManifest] = {}
        self._loaded = False

    def load(self, skills_dir: Optional[str] = None):
        """
        Discover and load all skills from the skills/ directory.
        Safe to call multiple times — only loads once.
        """
        if self._loaded:
            return

        if skills_dir is None:
            skills_dir = os.path.dirname(os.path.abspath(__file__))

        for entry in os.scandir(skills_dir):
            if not entry.is_dir() or entry.name.startswith(("_", ".")):
                continue

            skill_name = entry.name
            module_path = f"skills.{skill_name}.manifest"

            try:
                module = importlib.import_module(module_path)
                manifest: SkillManifest = module.MANIFEST
                self._skills[manifest.name] = manifest
                print(f"[SkillRegistry] Loaded skill: {manifest.display_name}")
            except ModuleNotFoundError:
                print(f"[SkillRegistry] Skipping {skill_name} — no manifest.py found")
            except Exception as e:
                print(f"[SkillRegistry] Error loading {skill_name}: {e}")

        self._loaded = True
        print(f"[SkillRegistry] {len(self._skills)} skills ready: {list(self._skills.keys())}")

    def get(self, name: str) -> Optional[SkillManifest]:
        return self._skills.get(name)

    def all(self) -> List[SkillManifest]:
        return list(self._skills.values())

    def get_all_tools(self) -> List[Any]:
        """Flatten all tools from all skills into one list for the agent."""
        tools = []
        for skill in self._skills.values():
            tools.extend(skill.tools)
        return tools

    def get_default_skill(self) -> Optional[SkillManifest]:
        for s in self._skills.values():
            if s.is_default:
                return s
        return None

    def build_system_prompt_section(self) -> str:
        """
        Generates the skills capability block injected into the master system prompt.
        """
        lines = [
            "## Your Skills\n",
            "You have access to the following skills. When a user's request matches a skill,",
            "you MUST call its tools AND emit a ui_directive so the dashboard switches to the right view.\n",
        ]
        for skill in self._skills.values():
            lines.append(skill.to_system_prompt_block())
            lines.append("")  # spacer

        lines.append(
            "\n## ui_directive Protocol\n"
            "After using any skill's tools, use the `emit_ui_directive` tool to tell the frontend "
            "which view to show. Pass `view` = the skill's ui_view value and include relevant `data`.\n"
            "Example: emit_ui_directive(view='linkedin_composer', data={'draft': '...', 'topic': '...'})\n"
        )
        return "\n".join(lines)


# Global singleton — imported by chat_agent.py
registry = SkillRegistry()
