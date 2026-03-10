function extractText() {
  const targetSelectors = [
    "script",
    "style",
    "noscript",
    "nav",
    "header",
    "footer",
    "aside",
    "form",
    "svg",
    "canvas",
    "iframe",
    "ads",
  ];

  /* clean up the page contents from elements we do not want to parse 
    /* since they most likely will not contain any useful text 
    */

  targetSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => element.remove());
  });

  // go through only the most commonly used nodes accross article sites and docs
  const targetNodes = [
    ...document.querySelectorAll("article, main, section, div"),
  ];

  /* find the node with the highest score : 
    /* i.e the with the most text and paragraphs and least links 
    */

  let bestNode = document.body;
  let bestScore = 0;

  for (const node of targetNodes) {
    const text = node.innerText || "";
    const length = text.trim().length;

    // skip nodes that are likely to contain no useful text

    if (
      /comment|meta|footer|footnote|sidebar|widget|nav/i.test(node.className)
    ) {
      continue;
    }

    // skip nodes that are likely to contain no useful text since it is too short
    if (length < 200) continue;

    // count the number of paragraphs and links in the node
    const paragraphCount = node.querySelectorAll("p").length;
    const linkCount = node.querySelectorAll("a").length;

    // calculate how much links there are per chunk of text, i.e link frequency
    const linkFrequency = linkCount / (length || 1);

    // use a scoring system to determine the best node
    const score = length * 1 + paragraphCount * 100 - linkFrequency * 500;

    // the container with the highest score, i.e longest and with least links wins
    // naturally this means the article container in most pages
    if (score > bestScore) {
      bestScore = score;
      bestNode = node;
    }
  }

  // target only the most common elements that are likely to contain useful text

  const elements = bestNode.querySelectorAll(
    "h1,h2,h3,h4,p,li,blockquote,pre,code",
  );

  // extract the text from the elements and join them with newlines
  const text = [...elements]
    .map((element) => element.innerText.trim())
    .filter(Boolean)
    .join("\n\n");

  return text;
}

console.log(extractText());
