import type { Post } from '@/types/post';

// Replace with your own posts. You can also migrate to MDX later.
export const posts: Post[] = [
  {
    slug: 'hello-world',
    title: 'Hello, World',
    date: '2025-08-01',
    excerpt: 'A friendly hello and a demo post.',
    content: `# Hello, World\n\nThis is **markdown** content.\n\n- Modular routing\n- Blogging with markdown\n- Add pages via \`lib/routes.ts\`\n\nHappy building!`,
  },
  {
    slug: 'study-habits',
    title: 'Study Habits That Stick',
    date: '2025-08-05',
    excerpt: 'Lightweight tips to keep your learning on track.',
    content: `## Keep it simple\n\n1. Set daily targets.\n2. Track progress.\n3. Review weekly.`,
  },
];