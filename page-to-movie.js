(() => {
  //first clean up the page
  if (window.pageToMovie && typeof window.pageToMovie.cleanup === "function") {
    window.pageToMovie.cleanup();
  }

  // the average reading speed is 200 words per minute
  const SENTENCE_LENGTH = 200;

  //text normalization
  function normalizeText(value) {
    //if we have multiple spaces, they should be replaced, then the text should be trimmed
    return value.replace(/\s+/g, " ").trim();
  }

  //html element visibility
  function isVisible(element) {
    //if the element is not an instance of an element of the Document then obviously it is not visible 
    if (!(element instanceof Element)) return false;

    //hidden properties - self explanatory
    if (element.hidden || element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    const style = window.getComputedStyle(element);

    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }

    //position relative to the viewport
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getTextContainers(node) {
    return [
      ...node.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,code"),
    ].filter(isVisible);
  }

  //text extraction
  function extractText() {

    // only the most commonly used nodes accross article sites and docs (for most websites)
    const targetNodes = [
      ...document.querySelectorAll("article, main, section, div, [role='main']"),
    ];

    /* find the node with the highest score : 
    /* i.e the with the most text and paragraphs and least links 
    */
    let bestNode = document.body;
    let bestScore = 0;

    for (const node of targetNodes) {
      if (!isVisible(node)) continue;

      const nodeClass = `${node.id} ${node.className}`;

       // skip nodes that are likely to contain no useful text
      if (
        /comment|meta|footer|footnote|sidebar|widget|nav|menu|toolbar|popup|modal|banner/i.test(
          nodeClass,
        )
      ) {
        continue;
      }

      // target only the most common elements that are likely to contain useful text
      const nodeTextContainers = getTextContainers(node);

      if (!nodeTextContainers.length) continue;

      // extract text from those elements
      const text = nodeTextContainers
        .map((element) => normalizeText(element.innerText || ""))
        .filter(Boolean)
        .join(" ");

      const length = text.length;

      // skip nodes that are likely to contain no useful text since it is too short
      if (length < SENTENCE_LENGTH) continue;

      // count the number of paragraphs, links and headings in the node
      const paragraphCount = node.querySelectorAll("p").length;
      const headingCount = node.querySelectorAll("h1,h2,h3").length;
      const linkCount = [...node.querySelectorAll("a")].reduce(
        (total, link) => total + normalizeText(link.innerText || "").length,
        0,
      );

      // calculate how much links there are per chunk of text, i.e link frequency
      const linkFrequency = linkCount / Math.max(length, 1);
      // use a scoring system to determine the best node
      const score =
        length + paragraphCount * 120 + headingCount * 80 - linkFrequency * 700;


      // the container with the highest score, i.e longest and with least links wins
      // naturally this means the article container in most pages
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    // target only the most common elements that are likely to contain useful text
    const bestNodeTextContainers = getTextContainers(bestNode);

    //list of uniquely seen text chunks
    const seen = new Set();
    const lines = [];

    for (const element of bestNodeTextContainers) {
      const text = normalizeText(element.innerText || "");

      if (!text || text.length < 2 || seen.has(text)) continue;

      seen.add(text);
      lines.push(text);
    }

    return lines.join("\n\n") || normalizeText(bestNode.innerText || "");
  }

  // split the sentence into parts by commas, semicolons, colons and spaces
  function splitSentence(sentence) {
    if (sentence.length <= SENTENCE_LENGTH) return [sentence];

    const sentenceChunks = sentence
      .split(/(?<=[,;:])\s+/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    // if its just one part, return the sentence
    if (sentenceChunks.length === 1) return [sentence];

    const chunks = [];
    let currentChunk = "";

    // construct the parts
    for (const chunk of sentenceChunks) {
      const nextChunk = currentChunk ? `${currentChunk} ${chunk}` : chunk;

      // if the next sentence is longer than the desired character limit
      // we push the current part and we continue with the splitting
      if (nextChunk.length > SENTENCE_LENGTH && currentChunk) {
        chunks.push(currentChunk);
        currentChunk = chunk;
      } else {
        currentChunk = nextChunk;
      }
    }

    // push the last chunk if it is not empty
    if (currentChunk) chunks.push(currentChunk);

    return chunks;
  }

  // split a large text into sentences
  function splitIntoSentences(text) {
    const cleanText = normalizeText(text);

    if (!cleanText) return [];

    let sentences = [];

    // use the Intl.Segmenter API if available, otherwise resort to regex
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(undefined, {
        granularity: "sentence",
      });

      sentences = [...segmenter.segment(cleanText)]
        .map((item) => item.segment.trim())
        .filter(Boolean);
    } else {
      sentences = (cleanText.match(/[^.!?]+(?:[.!?]+|$)/g) || [])
        .map((item) => item.trim())
        .filter(Boolean);
    }

    // split the sentences into chunks
    return sentences.flatMap(splitSentence).filter(Boolean);
  }

  //movie per-text duration preparation
  function getSentenceDuration(sentence) {
    const words = sentence.split(/\s+/).filter(Boolean).length;
    // calculate the duration in milliseconds
    // the average reading speed is 200 WPM
    // we multiply by 60000 to convert to milliseconds
    const duration = words / 200 * 60000
    return duration;
  }

  function createStage() {
    const html = document.documentElement;
    const body = document.body;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    html.style.margin = "0";
    html.style.width = "100%";
    html.style.height = "100%";
    html.style.background = "#ffffff";

    body.innerHTML = "";
    body.style.margin = "0";
    body.style.width = "100vw";
    body.style.height = "100vh";
    body.style.overflow = "hidden";
    body.style.display = "flex";
    body.style.alignItems = "center";
    body.style.justifyContent = "center";
    body.style.background = "#ffffff";

    canvas.style.display = "block";
    canvas.style.background = "#ffffff";
    canvas.style.boxShadow = "0 20px 60px rgba(0, 0, 0, 0.08)";
    canvas.style.maxWidth = "100vw";
    canvas.style.maxHeight = "100vh";

    body.appendChild(canvas);

    return { canvas, context };
  }

  //visuals for canvas frame
  function resizeCanvas(state) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const framePadding = Math.min(80, Math.max(24, viewportWidth * 0.06));
    let width = Math.min(1280, viewportWidth - framePadding * 2);
    let height = Math.min(720, viewportHeight - framePadding * 2);
    const aspectRatio = 16 / 9;

    if (width / height > aspectRatio) {
      width = height * aspectRatio;
    } else {
      height = width / aspectRatio;
    }

    width = Math.max(420, Math.round(width));
    height = Math.max(236, Math.round(height));

    const pixelRatio = window.devicePixelRatio || 1;

    state.width = width;
    state.height = height;
    state.canvas.width = Math.round(width * pixelRatio);
    state.canvas.height = Math.round(height * pixelRatio);
    state.canvas.style.width = `${width}px`;
    state.canvas.style.height = `${height}px`;
    state.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  //wrap lines for text layout - same as sentence splitting
  function wrapLines(context, text, maxWidth) {
    //split the text into words
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;

      // if the next line is longer than the max width or there is no current line
      // add the word to the current line
      if (context.measureText(nextLine).width <= maxWidth || !currentLine) {
        currentLine = nextLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);

    return lines;
  }

  function cleanup() {
    window.removeEventListener("resize", handleResize);
  }

  handleResize = () => {
    resizeCanvas(state);
  };

  window.pageToMovie = {
    cleanup,
  };
  
})();
