const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
const suggestionsList = document.getElementById('suggestions-list');
const mealList = document.getElementById('meal');
const mealDetails = document.querySelector('.meal-details');
const mealDetailsContent = document.querySelector('.meal-details-content');
const loadingSpinner = document.getElementById('loading-spinner');
const filterCategory = document.getElementById('filter-category');
const filterArea = document.getElementById('filter-area');
const sortOption = document.getElementById('sort-option');
const favoritesList = document.getElementById('favorites-list');

// New elements for meal planning
const mealPlanCalendar = document.getElementById('meal-plan-calendar');
const generateListBtn = document.getElementById('generate-list-btn');
const addToPlanModal = document.getElementById('add-to-plan-modal');
const shoppingListModal = document.getElementById('shopping-list-modal');

// New element for animation
const animationContainer = document.querySelector('.animation-container');

let resultsCache = {};
let suggestions = [
    'chicken', 'beef', 'pork', 'fish', 'egg',
    'rice', 'tomato', 'potato', 'cheese', 'carrot',
    'onion', 'garlic'
];
let activeSuggestionIndex = -1;
let allMeals = [];
let favoriteMeals = JSON.parse(localStorage.getItem('favoriteMeals') || '[]');
let mealPlan = JSON.parse(localStorage.getItem('mealPlan') || '{}');
let currentMealToAdd = null;

// Debounce function
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function showLoading() {
    loadingSpinner.hidden = false;
}

function hideLoading() {
    loadingSpinner.hidden = true;
}

function showSuggestions(value) {
    suggestionsList.innerHTML = '';
    if (!value) {
        suggestionsList.style.display = 'none';
        searchInput.setAttribute('aria-expanded', 'false');
        return;
    }
    const matched = suggestions.filter(i => i.toLowerCase().startsWith(value.toLowerCase()));
    if (matched.length === 0) {
        suggestionsList.style.display = 'none';
        searchInput.setAttribute('aria-expanded', 'false');
        return;
    }
    suggestionsList.style.display = 'block';
    searchInput.setAttribute('aria-expanded', 'true');

    matched.forEach((suggestion, index) => {
        const li = document.createElement('li');
        li.textContent = suggestion;
        li.setAttribute('role', 'option');
        li.id = `suggestion-${index}`;
        li.setAttribute('aria-selected', index === activeSuggestionIndex ? 'true' : 'false');
        li.tabIndex = -1;
        li.addEventListener('click', () => {
            searchInput.value = suggestion;
            suggestionsList.style.display = 'none';
            searchInput.setAttribute('aria-expanded', 'false');
            getMealList();
        });
        suggestionsList.appendChild(li);
    });
}

function handleSuggestionsNavigation(e) {
    const items = suggestionsList.querySelectorAll('li');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
        updateActiveSuggestion(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
        updateActiveSuggestion(items);
    } else if (e.key === 'Enter') {
        if (activeSuggestionIndex >= 0 && activeSuggestionIndex < items.length) {
            e.preventDefault();
            const selected = items[activeSuggestionIndex];
            searchInput.value = selected.textContent;
            suggestionsList.style.display = 'none';
            searchInput.setAttribute('aria-expanded', 'false');
            getMealList();
            activeSuggestionIndex = -1;
        }
    }
}

function updateActiveSuggestion(items) {
    items.forEach((item, index) => {
        if (index === activeSuggestionIndex) {
            item.setAttribute('aria-selected', 'true');
            searchInput.setAttribute('aria-activedescendant', item.id);
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.setAttribute('aria-selected', 'false');
        }
    });
}

async function getMealList() {
    const searchInputTxt = searchInput.value.trim();
    activeSuggestionIndex = -1;
    suggestionsList.style.display = 'none';
    searchInput.setAttribute('aria-expanded', 'false');

    if (!searchInputTxt) {
        mealList.innerHTML = '<p>Please enter an ingredient to search.</p>';
        return;
    }

    if (resultsCache[searchInputTxt]) {
        allMeals = resultsCache[searchInputTxt];
        applyFilters();
        return;
    }

    showLoading();

    try {
        const response = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${searchInputTxt}`);
        const data = await response.json();

        if (data.meals) {
            resultsCache[searchInputTxt] = data.meals;
            allMeals = data.meals;
            applyFilters();
        } else {
            mealList.innerHTML = `<p class="notFound">Sorry, we didn't find any meal!</p>`;
        }
    } catch (error) {
        mealList.innerHTML = `<p class="notFound">Error fetching meal data. Please try again later.</p>`;
    } finally {
        hideLoading();
    }
}

function highlightKeyword(text, keyword) {
    if (!keyword) return text;
    const regex = new RegExp(`(${keyword})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

function displayMeals(meals, keyword) {
    const fragment = document.createDocumentFragment();
    if (meals.length === 0) {
        mealList.innerHTML = `<p class="notFound">No meals found for these filters.</p>`;
        return;
    }

    meals.forEach(meal => {
        const mealItem = document.createElement('div');
        mealItem.classList.add('meal-item');
        mealItem.setAttribute('data-id', meal.idMeal);
        mealItem.setAttribute('role', 'listitem');

        const highlightedMealName = highlightKeyword(meal.strMeal, keyword);

        mealItem.innerHTML = `
      <div class="meal-img">
        <img src="${meal.strMealThumb}" alt="${meal.strMeal}" loading="lazy" />
      </div>
      <div class="meal-name">
        <h3>${highlightedMealName}</h3>
        <a href="#" class="recipe-btn">Get Recipe</a>
        <button class="add-to-plan-btn btn">Add to Plan</button>
        <button class="fav-btn" aria-label="Add to favorites">${favoriteMeals.some(m => m.idMeal === meal.idMeal) ? '★' : '☆'}</button>
      </div>
    `;

        fragment.appendChild(mealItem);
    });

    mealList.innerHTML = '';
    mealList.appendChild(fragment);

    updateFavoritesUI();
}

function applyFilters() {
    let filtered = [...allMeals];

    if (filterCategory.value) {
        filtered = filtered.filter(meal => meal.strCategory === filterCategory.value);
    }
    if (filterArea.value) {
        filtered = filtered.filter(meal => meal.strArea === filterArea.value);
    }
    if (sortOption.value === "name-asc") {
        filtered.sort((a, b) => a.strMeal.localeCompare(b.strMeal));
    } else if (sortOption.value === "name-desc") {
        filtered.sort((a, b) => b.strMeal.localeCompare(a.strMeal));
    }

    displayMeals(filtered, searchInput.value.trim());
}

// Favorite meals handlers
function updateFavoritesUI() {
    favoritesList.innerHTML = '';
    if (favoriteMeals.length === 0) {
        favoritesList.textContent = 'No favorite meals saved.';
        return;
    }
    favoriteMeals.forEach(meal => {
        const favItem = document.createElement('div');
        favItem.classList.add('favorite-item');
        favItem.innerHTML = `
      <img src="${meal.strMealThumb}" alt="${meal.strMeal}" />
      <p>${meal.strMeal}</p>
    `;
        favItem.addEventListener('click', () => {
            displayMealRecipe(meal);
        });
        favoritesList.appendChild(favItem);
    });
}

mealList.addEventListener('click', (e) => {
    if (e.target.classList.contains('fav-btn')) {
        const mealItem = e.target.closest('.meal-item');
        const mealId = mealItem.getAttribute('data-id');
        const meal = allMeals.find(m => m.idMeal === mealId);

        const index = favoriteMeals.findIndex(m => m.idMeal === mealId);
        if (index > -1) {
            favoriteMeals.splice(index, 1);
            e.target.textContent = '☆';
        } else {
            favoriteMeals.push(meal);
            e.target.textContent = '★';
        }
        localStorage.setItem('favoriteMeals', JSON.stringify(favoriteMeals));
        updateFavoritesUI();
    }
});

// Fetch and display detailed meal recipe with smooth modal
async function getMealRecipe(e) {
    e.preventDefault();
    if (e.target.classList.contains('recipe-btn')) {
        const mealItem = e.target.closest('.meal-item');
        const mealID = mealItem.getAttribute('data-id');

        showLoading();
        try {
            const response = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${mealID}`);
            const data = await response.json();

            if (data.meals) {
                displayMealRecipe(data.meals[0]);
            } else {
                mealDetailsContent.innerHTML = `<p>Recipe not found.</p>`;
            }
        } catch (error) {
            mealDetailsContent.innerHTML = `<p>Error loading recipe details. Please try again later.</p>`;
        } finally {
            hideLoading();
            mealDetails.classList.add('showRecipe');
        }
    }
}


function displayMealRecipe(meal) {
    mealDetailsContent.innerHTML = `
    <button type="button" class="btn recipe-close-btn" aria-label="Close recipe">
        &times;
    </button>
    <h2 id="recipe-title" class="recipe-title">${meal.strMeal}</h2>
    <p class="recipe-category">${meal.strCategory}</p>
    <div class="recipe-meal-img">
      <img src="${meal.strMealThumb}" alt="${meal.strMeal}" loading="lazy" />
    </div>
    <div id="recipe-instructions" class="recipe-instruct">
      <h3>Instructions:</h3>
      <p>${highlightKeyword(meal.strInstructions, searchInput.value.trim())}</p>
    </div>
    <div class="recipe-link">
      <a href="${meal.strYoutube}" target="_blank" rel="noopener">Watch Video</a>
    </div>
    <div class="recipe-actions">
      <button id="share-btn" class="btn">Share</button>
      <button id="print-btn" class="btn">Print</button>
    </div>
  `;

    // Add event listeners for share and print in modal
    mealDetailsContent.querySelector('#share-btn').addEventListener('click', () => {
        const mealTitle = meal.strMeal;
        const url = window.location.href;
        if (navigator.share) {
            navigator.share({
                title: mealTitle,
                text: `Check out this recipe: ${mealTitle}`,
                url: url,
            }).catch(console.error);
        } else {
            alert('Sharing is not supported on this browser.');
        }
    });

    mealDetailsContent.querySelector('#print-btn').addEventListener('click', () => {
        window.print();
    });

    mealDetailsContent.querySelector('.recipe-close-btn').addEventListener('click', () => {
        mealDetails.classList.remove('showRecipe');
        searchInput.focus();
    });
}

const debouncedGetMealList = debounce(getMealList, 300);
searchInput.addEventListener('input', () => {
    showSuggestions(searchInput.value);
    debouncedGetMealList();
});
searchInput.addEventListener('keydown', handleSuggestionsNavigation);
searchBtn.addEventListener('click', getMealList);
mealList.addEventListener('click', getMealRecipe);

async function loadFilters() {
    try {
        const [categoriesResp, areasResp] = await Promise.all([
            fetch('https://www.themealdb.com/api/json/v1/1/list.php?c=list'),
            fetch('https://www.themealdb.com/api/json/v1/1/list.php?a=list'),
        ]);
        const categories = await categoriesResp.json();
        const areas = await areasResp.json();

        if (categories.meals) {
            categories.meals.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.strCategory;
                option.textContent = cat.strCategory;
                filterCategory.appendChild(option);
            });
        }

        if (areas.meals) {
            areas.meals.forEach(area => {
                const option = document.createElement('option');
                option.value = area.strArea;
                option.textContent = area.strArea;
                filterArea.appendChild(option);
            });
        }
    } catch {

    }
}
// Dark Mode Toggle
const darkModeToggle = document.getElementById('dark-mode-toggle');

darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    darkModeToggle.setAttribute('aria-pressed', isDark);
    darkModeToggle.textContent = isDark ? '☀️' : '🌙';
});

// Voice Search Skeleton
const voiceSearchBtn = document.getElementById('voice-search-btn');

let recognition;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    voiceSearchBtn.addEventListener('click', () => {
        if (recognition) {
            recognition.start();
        }
    });

    recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript.toLowerCase();
        searchInput.value = transcript;
        getMealList();
    };

    recognition.onerror = function (event) {
        console.error('Speech recognition error', event.error);
    };

    recognition.onend = function () {
    };
} else {
    voiceSearchBtn.disabled = true;
    voiceSearchBtn.title = 'Voice search not supported in this browser';
}

loadFilters();
updateFavoritesUI();

const themePicker = document.getElementById('theme-picker');
if (themePicker) {
    themePicker.addEventListener('change', function () {
        document.body.classList.remove(
            'theme-default',
            'theme-blue',
            'theme-purple',
            'theme-gold',
            'theme-yellow',
            'theme-black'
        );
        document.body.classList.add('theme-' + themePicker.value);
        localStorage.setItem('selectedTheme', themePicker.value);
    });

    const savedTheme = localStorage.getItem('selectedTheme') || 'default';
    themePicker.value = savedTheme;
    document.body.classList.add('theme-' + savedTheme);
}

const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function renderMealPlanCalendar() {
    mealPlanCalendar.innerHTML = '';
    daysOfWeek.forEach(day => {
        const daySlot = document.createElement('div');
        daySlot.classList.add('day-slot');
        daySlot.setAttribute('data-day', day);
        daySlot.innerHTML = `<h3>${day.charAt(0).toUpperCase() + day.slice(1)}</h3><div class="meal-slot-container" id="container-${day}"></div>`;
        mealPlanCalendar.appendChild(daySlot);
    });
    renderMealsInPlan();
}

function renderMealsInPlan() {
    daysOfWeek.forEach(day => {
        const container = document.getElementById(`container-${day}`);
        container.innerHTML = '';
        if (mealPlan[day] && mealPlan[day].length > 0) {
            mealPlan[day].forEach(meal => {
                const mealSlot = document.createElement('div');
                mealSlot.classList.add('meal-slot');
                mealSlot.setAttribute('data-id', meal.id);
                mealSlot.innerHTML = `<p>${meal.name}</p><img src="${meal.img}" alt="${meal.name}" /><button class="remove-meal-btn">&times;</button>`;
                container.appendChild(mealSlot);
            });
        }
    });
}

mealList.addEventListener('click', (e) => {
    if (e.target.classList.contains('add-to-plan-btn')) {
        const mealItem = e.target.closest('.meal-item');
        currentMealToAdd = {
            id: mealItem.getAttribute('data-id'),
            name: mealItem.querySelector('h3').textContent,
            img: mealItem.querySelector('img').src
        };
        addToPlanModal.style.display = 'flex';
    }
});

addToPlanModal.addEventListener('click', (e) => {
    if (e.target.classList.contains('day-btn') && currentMealToAdd) {
        const day = e.target.getAttribute('data-day');
        if (!mealPlan[day]) {
            mealPlan[day] = [];
        }
        mealPlan[day].push(currentMealToAdd);
        localStorage.setItem('mealPlan', JSON.stringify(mealPlan));
        renderMealsInPlan();
        addToPlanModal.style.display = 'none';
        currentMealToAdd = null;
    }
    if (e.target.classList.contains('close-btn')) {
        addToPlanModal.style.display = 'none';
        currentMealToAdd = null;
    }
});

mealPlanCalendar.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-meal-btn')) {
        const mealSlot = e.target.closest('.meal-slot');
        const daySlot = e.target.closest('.day-slot');
        const day = daySlot.getAttribute('data-day');
        const mealId = mealSlot.getAttribute('data-id');

        mealPlan[day] = mealPlan[day].filter(meal => meal.id !== mealId);
        if (mealPlan[day].length === 0) {
            delete mealPlan[day];
        }

        localStorage.setItem('mealPlan', JSON.stringify(mealPlan));
        renderMealsInPlan();
    }
});

generateListBtn.addEventListener('click', async () => {
    const allIngredients = {};
    const mealsToFetch = [];

    for (const day in mealPlan) {
        if (mealPlan[day] && mealPlan[day].length > 0) {
            mealsToFetch.push(...mealPlan[day].map(meal => meal.id));
        }
    }

    if (mealsToFetch.length === 0) {
        alert('Your meal plan is empty!');
        return;
    }

    showLoading();

    try {
        const fetchPromises = mealsToFetch.map(id => fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`).then(res => res.json()));
        const results = await Promise.all(fetchPromises);

        results.forEach(result => {
            const meal = result.meals[0];
            if (!meal) return;

            for (let i = 1; i <= 20; i++) {
                const ingredient = meal[`strIngredient${i}`];
                const measure = meal[`strMeasure${i}`];

                if (ingredient && ingredient.trim() !== '') {
                    const cleanIngredient = ingredient.trim().toLowerCase();
                    const cleanMeasure = measure ? measure.trim() : '';

                    if (allIngredients[cleanIngredient]) {
                        if (cleanMeasure && !allIngredients[cleanIngredient].includes(cleanMeasure)) {
                            allIngredients[cleanIngredient].push(cleanMeasure);
                        }
                    } else {
                        allIngredients[cleanIngredient] = cleanMeasure ? [cleanMeasure] : [];
                    }
                }
            }
        });

        displayShoppingList(allIngredients);
    } catch (error) {
        console.error("Error generating shopping list:", error);
        alert('Failed to generate shopping list. Please try again.');
    } finally {
        hideLoading();
    }
});

function displayShoppingList(ingredients) {
    const shoppingListItems = document.getElementById('shopping-list-items');
    shoppingListItems.innerHTML = '';

    const sortedIngredients = Object.keys(ingredients).sort();

    if (sortedIngredients.length === 0) {
        shoppingListItems.innerHTML = '<li>No ingredients found in your meal plan.</li>';
    } else {
        sortedIngredients.forEach(ingredient => {
            const li = document.createElement('li');
            const measures = ingredients[ingredient].filter(m => m !== '' && m !== ' ');

            let displayString = ingredient.charAt(0).toUpperCase() + ingredient.slice(1);
            if (measures.length > 0) {
                displayString += ` (${measures.join(', ')})`;
            }
            li.textContent = displayString;
            shoppingListItems.appendChild(li);
        });
    }
    shoppingListModal.style.display = 'flex';
}

shoppingListModal.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-btn') || e.target === shoppingListModal) {
        shoppingListModal.style.display = 'none';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    renderMealPlanCalendar();
    typeWriter();
    startAnimation();
});

function typeWriter() {
    const textElement = document.getElementById('typing-text');
    const textToType = "Find Meals For Your Ingredients";
    let i = 0;

    function type() {
        if (i < textToType.length) {
            textElement.textContent += textToType.charAt(i);
            i++;
            setTimeout(type, 50);
        }
    }
    type();
}

function startAnimation() {

    animationContainer.classList.add('animate');

    setTimeout(() => {
        animationContainer.classList.remove('animate');
    }, 8000);

    setInterval(() => {
        animationContainer.classList.add('animate');
        setTimeout(() => {
            animationContainer.classList.remove('animate');
        }, 8000);
    }, 8000);
}