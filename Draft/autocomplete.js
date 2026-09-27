// autocomplete.js
export function setupAutocomplete(input, airports) {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
  
    const suggestionBox = document.createElement('div');
    suggestionBox.className = 'autocomplete-suggestions';
    wrapper.appendChild(suggestionBox);
  
    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      suggestionBox.innerHTML = '';
  
      if (!query) return;
  
      const matches = airports
        .filter(a => {
          return (
            a.iata?.toLowerCase().includes(query) ||
            a.icao?.toLowerCase().includes(query) ||
            a.name?.toLowerCase().includes(query) ||
            a.city?.toLowerCase().includes(query)
          );
        })
        .slice(0, 10); // 最多顯示10筆
  
      matches.forEach(airport => {
        const option = document.createElement('div');
        option.className = 'autocomplete-suggestion';
        option.textContent = `${airport.city}, ${airport.country} ${airport.name} (${airport.iata})`;
        option.addEventListener('click', () => {
          input.value = airport.iata;
          suggestionBox.innerHTML = '';
        });
        suggestionBox.appendChild(option);
      });
    });
  
    input.addEventListener('blur', () => {
      setTimeout(() => (suggestionBox.innerHTML = ''), 100); // 點擊後延遲清除
    });
  }
  