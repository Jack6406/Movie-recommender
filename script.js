// Configuration
const CONFIG = {
  API_KEY: '510ed0aadb8e136c7adc6a3d41254150', // Replace with your actual TMDB API key
  BASE_URL: 'https://api.themoviedb.org/3',
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  MAX_RESULTS: 3
};

// Cache for API responses
const cache = new Map();

// DOM elements
const elements = {
  form: document.getElementById('movieForm'),
  yearInput: document.getElementById('year'),
  genreSelect: document.getElementById('genre'),
  submitBtn: document.getElementById('submitBtn'),
  btnText: document.querySelector('.btn-text'),
  btnLoading: document.querySelector('.btn-loading'),
  results: document.getElementById('results'),
  yearError: document.getElementById('year-error'),
  genreError: document.getElementById('genre-error'),
  randomBtn: document.getElementById('randomBtn')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

async function initializeApp() {
  try {
    // Load genres for dropdown
    await loadGenres();
    
    // Set up form event listeners
    setupEventListeners();
    
    // Set current year as default
    elements.yearInput.value = new Date().getFullYear();
    
  } catch (error) {
    console.error('Failed to initialize app:', error);
    showError('Failed to initialize the application. Please refresh the page.');
  }
}

function setupEventListeners() {
  // Form submission
  elements.form.addEventListener('submit', handleFormSubmit);
  
  // Real-time validation
  elements.yearInput.addEventListener('input', () => validateYear());
  elements.genreSelect.addEventListener('change', () => validateGenre());
  
  // Clear errors on focus
  elements.yearInput.addEventListener('focus', () => clearError('year'));
  elements.genreSelect.addEventListener('focus', () => clearError('genre'));

  elements.randomBtn.addEventListener('click', handleRandomise);
}

async function handleFormSubmit(e) {
  e.preventDefault();
  
  // Validate form
  if (!validateForm()) {
    return;
  }
  
  const year = elements.yearInput.value;
  const genre = elements.genreSelect.value;
  
  try {
    setLoading(true);
    const movies = await getMovieRecommendations(year, genre);
    displayResults(movies);
  } catch (error) {
    console.error('Error fetching movies:', error);
    showError('Failed to fetch movie recommendations. Please try again.');
  } finally {
    setLoading(false);
  }
}

function validateForm() {
  const isYearValid = validateYear();
  const isGenreValid = validateGenre();
  return isYearValid && isGenreValid;
}

function validateYear() {
  const year = parseInt(elements.yearInput.value);
  const currentYear = new Date().getFullYear();
  
  if (!elements.yearInput.value) {
    showFieldError('year', 'Year is required');
    return false;
  }
  
  if (year < 1900 || year > currentYear) {
    showFieldError('year', `Year must be between 1900 and ${currentYear}`);
    return false;
  }
  
  clearError('year');
  return true;
}

function validateGenre() {
  const genre = elements.genreSelect.value;
  
  if (!genre) {
    showFieldError('genre', 'Please select a genre');
    return false;
  }
  
  clearError('genre');
  return true;
}

function showFieldError(field, message) {
  const errorElement = field === 'year' ? elements.yearError : elements.genreError;
  errorElement.textContent = message;
  errorElement.style.display = 'block';
}

function clearError(field) {
  const errorElement = field === 'year' ? elements.yearError : elements.genreError;
  errorElement.textContent = '';
  errorElement.style.display = 'none';
}

function setLoading(isLoading) {
  elements.submitBtn.disabled = isLoading;
  elements.btnText.style.display = isLoading ? 'none' : 'inline';
  elements.btnLoading.style.display = isLoading ? 'inline' : 'none';
}

async function loadGenres() {
  try {
    console.log('Loading genres...');
    const genres = await fetchWithCache('/genre/movie/list');
    console.log('Genres loaded:', genres);
    
    if (genres && genres.genres && Array.isArray(genres.genres)) {
      populateGenreSelect(genres.genres);
      console.log('Genre dropdown populated with', genres.genres.length, 'genres');
    } else {
      console.error('Invalid genres data structure:', genres);
      showError('Failed to load genres. Please refresh the page.');
    }
  } catch (error) {
    console.error('Failed to load genres:', error);
    showError('Failed to load genres. Please check your internet connection and refresh the page.');
  }
}

function populateGenreSelect(genres) {
  // Clear existing options and add loading state
  elements.genreSelect.innerHTML = '<option value="">Loading genres...</option>';
  
  // Sort genres alphabetically
  genres.sort((a, b) => a.name.localeCompare(b.name));
  
  // Clear and add placeholder
  elements.genreSelect.innerHTML = '<option value="">Select a genre...</option>';
  
  // Add genre options
  genres.forEach(genre => {
    const option = document.createElement('option');
    option.value = genre.name;
    option.textContent = genre.name;
    elements.genreSelect.appendChild(option);
  });
  
  console.log('Dropdown populated with genres:', genres.map(g => g.name));
}

async function getMovieRecommendations(year, genre) {
  // Get genre ID
  const genres = await fetchWithCache('/genre/movie/list');
  const genreObj = genres.genres.find(g => 
    g.name.toLowerCase() === genre.toLowerCase()
  );
  
  if (!genreObj) {
    throw new Error(`Genre "${genre}" not found`);
  }
  
  // Fetch movies with multiple pages to get more variety
  const allMovies = [];
  const pagesToFetch = 3; // Fetch 3 pages for more variety
  
  for (let page = 1; page <= pagesToFetch; page++) {
    const params = new URLSearchParams({
      api_key: CONFIG.API_KEY,
      sort_by: 'vote_average.desc',
      'vote_count.gte': 100,
      with_genres: genreObj.id,
      primary_release_year: year,
      page: page
    });
    
    const movies = await fetchWithCache(`/discover/movie?${params}`);
    if (movies.results && movies.results.length > 0) {
      allMovies.push(...movies.results);
    }
  }
  
  // Filter out Hindi movies, remove duplicates, and filter by rating > 6
  const uniqueMovies = allMovies
    .filter(movie => movie.original_language !== 'hi') // Exclude Hindi movies
    .filter(movie => movie.vote_average > 6) // Only movies with rating > 6
    .filter((movie, index, self) => 
      index === self.findIndex(m => m.id === movie.id)
    );
  
  // Shuffle the movies for randomization
  const shuffledMovies = shuffleArray(uniqueMovies);
  
  // Return the first MAX_RESULTS movies
  return shuffledMovies.slice(0, CONFIG.MAX_RESULTS);
}

// Fisher-Yates shuffle algorithm for randomizing array
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function fetchWithCache(endpoint) {
  // Add API key to the endpoint if it's not already included
  const url = endpoint.includes('api_key=') 
    ? `${CONFIG.BASE_URL}${endpoint}`
    : `${CONFIG.BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${CONFIG.API_KEY}`;
  
  const cacheKey = url;
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
    return cached.data;
  }
  
  // Fetch from API
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Cache the response
  cache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  
  return data;
}

function displayResults(movies) {
  if (movies.length === 0) {
    elements.results.innerHTML = `
      <div class="no-results">
        <h3>No movies found</h3>
        <p>Try adjusting your search criteria or try a different year/genre combination.</p>
      </div>
    `;
    return;
  }
  
  const moviesHTML = movies.map(movie => createMovieCard(movie)).join('');
  elements.results.innerHTML = moviesHTML;
}

function createMovieCard(movie) {
  const posterPath = movie.poster_path 
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : 'https://via.placeholder.com/500x750/cccccc/666666?text=No+Poster';
  
  const releaseDate = movie.release_date 
    ? new Date(movie.release_date).getFullYear()
    : 'Unknown';
  
  const overview = movie.overview 
    ? (movie.overview.length > 200 
        ? movie.overview.substring(0, 200) + '...' 
        : movie.overview)
    : 'No overview available.';
  
  return `
    <div class="movie">
      <div class="movie-content">
        <img 
          src="${posterPath}" 
          alt="Poster for ${movie.title}"
          class="movie-poster"
          loading="lazy"
          onerror="this.src='https://via.placeholder.com/500x750/cccccc/666666?text=No+Poster'"
        >
        <div class="movie-info">
          <h2>${movie.title}</h2>
          <p class="movie-overview">${overview}</p>
          <div class="movie-meta">
            <div class="meta-item">
              <span class="rating">⭐ ${movie.vote_average.toFixed(1)}</span>
            </div>
            <div class="meta-item">
              📅 ${releaseDate}
            </div>
            <div class="meta-item">
              🗣️ ${movie.original_language.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function showError(message) {
  elements.results.innerHTML = `
    <div class="error">
      <h3>Error</h3>
      <p>${message}</p>
    </div>
  `;
}

function showLoading() {
  elements.results.innerHTML = `
    <div class="loading">
      <h3>Loading...</h3>
      <p>Fetching movie recommendations...</p>
    </div>
  `;
}

async function handleRandomise() {
  setRandomLoading(true);
  try {
    // Load genres if not already loaded
    const genresData = await fetchWithCache('/genre/movie/list');
    const genres = genresData.genres;
    if (!genres || genres.length === 0) {
      showError('No genres available for randomisation.');
      return;
    }
    // Pick random genre
    const randomGenre = genres[Math.floor(Math.random() * genres.length)];
    // Pick random year between 1900 and current year
    const currentYear = new Date().getFullYear();
    const randomYear = Math.floor(Math.random() * (currentYear - 1900 + 1)) + 1900;
    // Fetch movies for random genre and year
    setFormFields(randomYear, randomGenre.name);
    const movies = await getMovieRecommendations(randomYear, randomGenre.name);
    if (movies.length === 0) {
      displayResults([]);
      return;
    }
    // Pick a single random movie from the results
    const randomMovie = movies[Math.floor(Math.random() * movies.length)];
    displayResults([randomMovie]);
  } catch (error) {
    console.error('Error during randomise:', error);
    showError('Failed to randomise movie. Please try again.');
  } finally {
    setRandomLoading(false);
  }
}

function setRandomLoading(isLoading) {
  elements.randomBtn.disabled = isLoading;
  const btnText = elements.randomBtn.querySelector('.btn-text');
  const btnLoading = elements.randomBtn.querySelector('.btn-loading');
  btnText.style.display = isLoading ? 'none' : 'inline';
  btnLoading.style.display = isLoading ? 'inline' : 'none';
}

function setFormFields(year, genreName) {
  elements.yearInput.value = year;
  // Set genre select to the correct option
  for (const option of elements.genreSelect.options) {
    if (option.value.toLowerCase() === genreName.toLowerCase()) {
      elements.genreSelect.value = option.value;
      break;
    }
  }
}
