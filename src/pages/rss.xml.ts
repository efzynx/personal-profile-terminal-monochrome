import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { listPosts, getProfileData } from '../lib/cms';
import { listPublishedNews } from '../lib/news';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const profile = await getProfileData();
  const siteUrl = (process.env.PUBLIC_SITE_URL && !process.env.PUBLIC_SITE_URL.includes('localhost'))
    ? process.env.PUBLIC_SITE_URL
    : (context.site && !context.site.toString().includes('localhost') ? context.site.toString() : 'https://www.efzyn.my.id');

  let posts: any[] = [];
  try {
    posts = await listPosts();
  } catch (err) {
    console.error('Error fetching posts for RSS:', err);
  }

  let news: any[] = [];
  try {
    news = await listPublishedNews();
  } catch (err) {
    console.error('Error fetching news for RSS:', err);
  }

  const blogItems = posts.map(post => {
    let pubDate = new Date();
    if (post.frontmatter?.pubDate) {
      const d = new Date(post.frontmatter.pubDate);
      if (!isNaN(d.getTime())) pubDate = d;
    }
    return {
      title: `[Blog] ${post.frontmatter?.title || 'Untitled Post'}`,
      description: post.frontmatter?.description || '',
      pubDate,
      link: `/blog/posts/${post.slug}`,
      categories: post.frontmatter?.tags || [],
    };
  });

  const newsItems = news.map(item => {
    let pubDate = new Date();
    if (item.publishedAt || item.createdAt) {
      const d = new Date(item.publishedAt || item.createdAt);
      if (!isNaN(d.getTime())) pubDate = d;
    }
    return {
      title: `[News] ${item.title || 'Untitled News'}`,
      description: item.summary || '',
      pubDate,
      link: `/news/${item.id}`,
      categories: item.tags || [],
    };
  });

  const allItems = [...blogItems, ...newsItems].sort(
    (a, b) => b.pubDate.getTime() - a.pubDate.getTime()
  );

  return rss({
    title: `${profile.name || 'Ahmad Fauzan Adiman'} — Terminal Monochrome`,
    description: profile.bio || 'Personal blog, technical notes, and curated tech news feed',
    site: siteUrl,
    items: allItems,
    customData: `<language>id</language>`,
  });
};
