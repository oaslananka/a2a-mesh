import { A2AClient, type AgentSkill } from 'a2a-mesh';

export async function discoverAgent(url: string, options: { json?: boolean } = {}) {
  const client = new A2AClient(url);
  const card = await client.resolveCard();

  if (!options.json) {
    process.stdout.write(`\nDiscovered Agent Card for: ${card.name} v${card.version}\n`);
    process.stdout.write(`URL: ${card.url}\n`);
    process.stdout.write(`Description: ${card.description}\n`);
    process.stdout.write('Skills:\n');
    if (card.skills) {
      card.skills.forEach((skill: AgentSkill) => {
        process.stdout.write(`  - ${skill.name} [${(skill.tags || []).join(', ')}]\n`);
      });
    } else {
      process.stdout.write('  (None)\n');
    }
  }

  return card;
}
