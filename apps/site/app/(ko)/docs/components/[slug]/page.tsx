import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Code, Demo, DocHeader, NextLinks, Props } from '../../../../../components/docs';
import { COMPONENT_DOCS } from '../../../../../lib/component-docs';
import { pageMeta } from '../../../../../lib/meta';

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPONENT_DOCS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = COMPONENT_DOCS.find((c) => c.slug === slug);
  return doc ? pageMeta(`docs-components-${doc.slug}`, doc.name, `${doc.name}: ${doc.summary}. ${doc.body}`) : { title: '컴포넌트' };
}

export default async function ComponentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const index = COMPONENT_DOCS.findIndex((c) => c.slug === slug);
  const doc = COMPONENT_DOCS[index];
  if (!doc) notFound();
  const next = COMPONENT_DOCS[index + 1];
  const prev = COMPONENT_DOCS[index - 1];

  return (
    <article className="doc">
      <DocHeader category={doc.group} title={doc.name} lead={doc.body} />
      <Demo>{doc.demo}</Demo>
      <h2>사용법</h2>
      <Code>{doc.code}</Code>
      <h2>속성</h2>
      <Props rows={doc.props} />
      <NextLinks
        items={[
          ...(prev ? [{ href: `/docs/components/${prev.slug}/`, title: `← ${prev.name}`, desc: prev.summary }] : []),
          ...(next ? [{ href: `/docs/components/${next.slug}/`, title: next.name, desc: next.summary }] : []),
        ]}
      />
    </article>
  );
}
