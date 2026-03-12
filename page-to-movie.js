(() => {
  //first clean up the page
  if (window.pageToMovie && typeof window.pageToMovie.cleanup === "function") {
    window.pageToMovie.cleanup();
  }

  // the average reading speed is 200 words per minute
  const WPM = 225;

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
      if (length < WPM) continue;

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
    if (sentence.length <= WPM) return [sentence];

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
      if (nextChunk.length > WPM && currentChunk) {
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
    const duration = words / WPM * 60000
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

  //create text layout for canvas frame
  function createTextLayout(state, text) {
    const maxWidth = state.width * 0.78;
    let fontSize = Math.min(48, state.width * 0.055, state.height * 0.12);

    if (text.length > 150) {
      fontSize *= 0.78;
    } else if (text.length > 110) {
      fontSize *= 0.88;
    }

    //max font size is 48px - depends on the width and height of the canvas
    fontSize = Math.max(24, fontSize);

    let lines = [];

    //slowly decrease the font size until we have 5 lines or less for better readability
    while (fontSize >= 24) {
      state.context.font = `${Math.round(fontSize)}px Georgia, "Times New Roman", serif`;
      lines = wrapLines(state.context, text, maxWidth);

      if (lines.length <= 5) break;

      fontSize -= 2;
    }

    return {
      fontSize,
      lineHeight: fontSize * 1.4,
      lines,
    };
  }

  //draw a frame on the canvas
  function drawFrame(state, text, opacity) {
    const context = state.context;

    //clear the canvas
    context.clearRect(0, 0, state.width, state.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, state.width, state.height);
    context.strokeStyle = "rgba(0, 0, 0, 0.08)";
    context.strokeRect(0.5, 0.5, state.width - 1, state.height - 1);

    if (!text) return;

    //create the text layout
    const layout = createTextLayout(state, text);
    const totalHeight = layout.lineHeight * layout.lines.length;

    //position of the text - middle of the canvas
    const x = state.width / 2;
    let y = (state.height - totalHeight) / 2 + layout.fontSize;

    context.globalAlpha = opacity;
    context.fillStyle = "#111111";
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.font = `${Math.round(layout.fontSize)}px Georgia, "Times New Roman", serif`;

    for (const line of layout.lines) {
      //draw the text in the middle of the canvas
      context.fillText(line, x, y);
      y += layout.lineHeight;
    }

    context.globalAlpha = 1;
  }

  //get the opacity of the text - fade in and out
  //based on what step we are in the animation
  //movie-like effect
  function getOpacity(elapsed, holdDuration) {
    const fadeDuration = Math.min(500, holdDuration * 0.25);
    const totalDuration = holdDuration + fadeDuration * 2;

    if (elapsed < fadeDuration) {
      return elapsed / fadeDuration;
    }

    if (elapsed > totalDuration - fadeDuration) {
      return Math.max(0, (totalDuration - elapsed) / fadeDuration);
    }

    return 1;
  }

  const handleResize = () => {
    resizeCanvas(state);
    const currentSentence = state.sentences[state.index];
    drawFrame(state, currentSentence ? currentSentence.text : "", 1);
  };

  //finish the movie
  function finishPlayback(state) {
    if (!state.running) return;

    state.running = false;
    drawFrame(state, "", 1);
  }

  //play the movie
  function play(state) {
    state.running = true;
    state.index = 0;
    state.startedAt = 0;

    //animation loop
    const tick = (now) => {
      if (!state.running) return;

      if (!state.startedAt) {
        state.startedAt = now;
      }

      // get the current sentence
      const current = state.sentences[state.index];

      if (!current) {
        // if there is no current sentence stop
        finishPlayback(state);
        return;
      }

      const fadeDuration = Math.min(500, current.duration * 0.25);
      const totalDuration = current.duration + fadeDuration * 2;
      const elapsed = now - state.startedAt;

      // if the elapsed time for the display is more than what it should be, go to the next sentence
      if (elapsed >= totalDuration) {
        state.index += 1;
        state.startedAt = now;

        //finish the movie if there are no more sentences
        if (state.index >= state.sentences.length) {
          finishPlayback(state);
          return;
        }
      }

      const currentSentence = state.sentences[state.index];
      const currentElapsed = now - state.startedAt;
      const opacity = getOpacity(currentElapsed, currentSentence.duration);

      drawFrame(state, currentSentence.text, opacity);
      // request the next frame with the next text chun
      state.rafId = window.requestAnimationFrame(tick);
    };

    // start the animation loop
    state.rafId = window.requestAnimationFrame(tick);
  }

  const extractedText = extractText();
  const sentences = splitIntoSentences(extractedText);
  const safeSentences = (sentences.length
    ? sentences
    : ["No readable text was found on this page."]
  ).map((text) => ({
    text,
    duration: getSentenceDuration(text),
  }));
  const stage = createStage();
  const state = {
    ...stage,
    width: 0,
    height: 0,
    sentences: safeSentences,
    index: 0,
    startedAt: 0,
    running: false,
    rafId: 0,
  };


  window.pageToMovie = {
    cleanup() {
      state.running = false;

      // if there is an ongoing animation, cancel it
      if (state.rafId) {
        window.cancelAnimationFrame(state.rafId);
      }

      // remove the resize listener and replace it with the one for the canvas
      window.removeEventListener("resize", handleResize);
    },
  };

  window.addEventListener("resize", handleResize);

  resizeCanvas(state);
  drawFrame(state, "", 1);
  play(state);
})();
