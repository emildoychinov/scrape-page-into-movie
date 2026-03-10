function extractReadableText() {
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
  
    targetSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => element.remove());
    });
  
    const targetNodes = [...document.querySelectorAll("article, main, section, div")];
  
    let bestNode = document.body;
    let bestScore = 0;
  
    for (const node of targetNodes) {
      const text = node.innerText || "";
      const length = text.trim().length;

      if (/comment|meta|footer|footnote|sidebar|widget|nav/i.test(node.className)) {
        continue;
      }
  
      if (length < 200) continue;
  
      const paragraphCount = node.querySelectorAll("p").length;
      const linkCount = node.querySelectorAll("a").length;
  
      const linkDensity = linkCount / (length || 1);
  
      const score =
        length * 1 +
        paragraphCount * 100 -
        linkDensity * 500;
  
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    const elements = bestNode.querySelectorAll(
      "h1,h2,h3,h4,p,li,blockquote,pre,code"
    );
  
    const text = [...elements]
      .map(element => element.innerText.trim())
      .filter(Boolean)
      .join("\n\n");
  
    return text;
  }
  
  console.log(extractReadableText());