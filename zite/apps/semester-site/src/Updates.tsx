import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Skeleton } from '@project/components/ui/skeleton';
import { publishedPosts, PublishedPostsOutputType } from 'zitejs/api';
import { PageTitle } from './Layout';

type Post = PublishedPostsOutputType['posts'][0];
const when = (d: string) => (d ? format(new Date(d), 'd MMMM yyyy') : '');

function usePosts(slug?: string) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  useEffect(() => { publishedPosts({ slug }).then((r) => setPosts(r.posts)).catch(() => setPosts([])); }, [slug]);
  return posts;
}

export function Updates() {
  const posts = usePosts();
  return (
    <>
      <PageTitle eyebrow="Updates" title="News from Semester" intro="Every post here was reviewed and approved by someone other than its author before it went live." />
      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        {!posts ? <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
          : posts.length === 0 ? <p className="border-t border-border pt-8 text-muted-foreground">Nothing published yet.</p>
          : <ul className="divide-y divide-border border-t border-border">{posts.map((p) => (
              <li key={p.slug} className="py-6">
                <p className="eyebrow text-muted-foreground">{when(p.publishedAt)}</p>
                <Link to={`/updates/${p.slug}`} className="mt-1 block text-2xl hover:underline">{p.title}</Link>
                {p.summary && <p className="mt-2 max-w-2xl text-muted-foreground">{p.summary}</p>}
              </li>))}</ul>}
      </div>
    </>
  );
}

export function UpdatePost() {
  const { slug } = useParams();
  const posts = usePosts(slug);
  const p = posts?.[0];
  if (!posts) return <div className="mx-auto max-w-3xl space-y-4 px-4 py-14 sm:px-6"><Skeleton className="h-10" /><Skeleton className="h-40" /></div>;
  if (!p) return <PageTitle eyebrow="Updates" title="That post isn’t available" intro={<Link to="/updates" className="text-primary underline">See all updates</Link>} />;
  return (
    <article className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <PageTitle eyebrow={when(p.publishedAt)} title={p.title} intro={p.summary} />
      <div className="whitespace-pre-wrap px-4 text-base leading-relaxed sm:px-6">{p.body}</div>
      <Link to="/updates" className="mt-10 block px-4 text-sm text-primary underline sm:px-6">← All updates</Link>
    </article>
  );
}
