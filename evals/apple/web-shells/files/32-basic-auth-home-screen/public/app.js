fetch('/api/orders.json').then((response) => response.json()).then((orders) => {
  document.getElementById('count').textContent = `${orders.length} orders today`;
});
