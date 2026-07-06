class MoviesModTemplate extends MProvider {
  // --- CONFIGURATION ---
  // Change this to the actual website domain (e.g., "moviesgum.com")
  get baseUrl() { return "https://moviesgum.com/"; }
  
  get isManga() { return false; } // False for Movies/Anime
  get supportsLatest() { return true; }

  // --- 1. POPULAR MOVIES ---
  async getPopular(page) {
    return await this.fetchMovies(`${this.baseUrl}/page/${page}`);
  }

  // --- 2. LATEST MOVIES ---
  async getLatestUpdates(page) {
    return await this.fetchMovies(`${this.baseUrl}/page/${page}`);
  }

  // --- 3. SEARCH ---
  async search(query, page, filters) {
    return await this.fetchMovies(`${this.baseUrl}/page/${page}?s=${encodeURIComponent(query)}`);
  }

  // --- HELPER: Fetch & Parse Movie List ---
  async fetchMovies(url) {
    // Use Mangayomi's built-in Client
    const res = await new Client().get(url);
    // Use Mangayomi's built-in Document parser
    const document = new Document(res.body);
    
    const list = [];
    
    // SELECTOR: Replace '.blog-picture' parent if needed. 
    // Usually the card is the parent of the image. 
    // If '.blog-picture' is the image, we select its parent or a common container.
    // Assuming the structure: <div class="card"><img class="blog-picture" ...></div>
    // We select the image directly and traverse up, or select the container if known.
    // Safer bet: Select the container class if you know it (e.g., '.post-item'). 
    // If not, we select the images and map them.
    
    const images = document.select("img.blog-picture"); 

    for (const img of images) {
      const title = img.attr("alt") || "Unknown Title";
      let poster = img.attr("src");
      
      // Fix relative URLs
      if (poster && poster.startsWith("/")) poster = this.baseUrl + poster;

      // Find the link (usually the parent <a> tag)
      // We look for the closest <a> ancestor or the sibling link
      let link = img.parent()?.attr("href"); 
      
      // If parent isn't a link, try finding an <a> inside the same container
      if (!link || !link.startsWith("http")) {
         const parentCard = img.parent(); 
         const linkEl = parentCard?.selectFirst("a");
         link = linkEl ? linkEl.attr("href") : null;
      }

      if (link) {
        if (link.startsWith("/")) link = this.baseUrl + link;
        
        list.push({
          name: title,
          imageUrl: poster,
          url: link
        });
      }
    }

    return { list, hasNextPage: list.length > 0 };
  }

  // --- 4. MOVIE DETAILS ---
  async getDetail(url) {
    const res = await new Client().get(url);
    const document = new Document(res.body);

    // Extract Title
    let title = document.selectFirst("h1, .entry-title, .post-title")?.text;
    if (!title) {
      const titleMatch = res.body.match(/<title>(.*?)<\/title>/);
      title = titleMatch ? titleMatch[1].replace(/ - .*$/, "").trim() : "Unknown";
    }

    // Extract Description
    const description = document.selectFirst(".post-content, .entry-content, .description, meta[name='description']")?.text?.trim() || "No description.";

    // Extract Genres (Optional)
    const genreElements = document.select(".genres a, .movie-genre a, .tag-links a");
    const genre = genreElements.map(e => e.text);

    // Episodes: For movies, we often just pass the current URL to getVideoList
    // Or if there are multiple server buttons, list them here.
    const episodes = [{
      name: "Watch Movie",
      url: url
    }];

    return {
      title,
      description,
      genre,
      episodes
    };
  }

  // --- 5. VIDEO LINKS ---
  async getVideoList(url) {
    const res = await new Client().get(url);
    const document = new Document(res.body);
    const body = res.body;

    const list = [];

    // STRATEGY A: Iframe
    const iframe = document.selectFirst("iframe");
    if (iframe) {
      let videoUrl = iframe.attr("src");
      if (videoUrl && videoUrl.startsWith("/")) videoUrl = this.baseUrl + videoUrl;
      
      if (videoUrl) {
        list.push({ url: videoUrl, quality: "Iframe", originalUrl: videoUrl });
      }
    }

    // STRATEGY B: Direct MP4/M3U8 in source
    if (list.length === 0) {
      const mp4 = body.substringBetween('src="', '.mp4"');
      if (mp4) {
        list.push({ url: mp4 + ".mp4", quality: "Direct", originalUrl: mp4 + ".mp4" });
      }
    }
    
    // STRATEGY C: Specific Button Data
    if (list.length === 0) {
       const btn = document.selectFirst("a.play-btn, button[data-link]");
       const dataLink = btn?.attr("data-link") || btn?.attr("href");
       if (dataLink && dataLink.startsWith("http")) {
         list.push({ url: dataLink, quality: "External", originalUrl: dataLink });
       }
    }

    if (list.length === 0) {
      throw new Error("No video links found. Inspect the page for iframes or direct links.");
    }

    return list;
  }
}   
