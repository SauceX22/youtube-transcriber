const test = require("node:test");
const assert = require("node:assert/strict");

const { detect } = require("./media-page-detector.js");

function documentWithMeta(entries) {
  return {
    title: entries.title || "",
    querySelector(selector) {
      const value = entries[selector];
      return value ? { content: value, href: value } : null;
    },
  };
}

test("detects a video post on a custom-domain Substack publication", () => {
  const document = documentWithMeta({
    'meta[name="twitter:player"]':
      "https://www.rfemedia.com/embed/podcast/elite-anxiety-frustrated-in-iran?autoplay=1",
    'meta[property="og:image"]':
      "https://substackcdn.com/image/fetch/$s_!8iUw!,w_1200/https%3A%2F%2Fsubstack-video.s3.amazonaws.com%2Fvideo_upload%2Fpost%2F211630389%2F749feb9c-4fac-497d-956a-49006112b390%2Ftranscoded-00001.png",
    'meta[property="og:title"]':
      "Elite Anxiety: Frustrated in Iran and Asia, Militarism Expands Across the Americas w/ Greg Stoker",
  });
  const location = {
    href: "https://www.rfemedia.com/p/elite-anxiety-frustrated-in-iran",
    pathname: "/p/elite-anxiety-frustrated-in-iran",
  };

  assert.deepEqual(detect(document, location), {
    ok: true,
    url: location.href,
    pageUrl: location.href,
    title:
      "Elite Anxiety: Frustrated in Iran and Asia, Militarism Expands Across the Americas w/ Greg Stoker",
    videoId: "substack:211630389",
    platform: "substack",
  });
});

test("does not classify an ordinary article as a Substack media post", () => {
  const document = documentWithMeta({
    'meta[property="og:image"]': "https://example.com/article.png",
    'meta[property="og:title"]': "Ordinary article",
  });

  assert.equal(
    detect(document, {
      href: "https://example.com/p/ordinary-article",
      pathname: "/p/ordinary-article",
    }),
    null
  );
});
