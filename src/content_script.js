// web extensions polyfill for ff/chrome
window.browser = (() => {
    return window.browser || window.chrome;
})();

let tabListTabId = null;

async function listTabs() {
    const list = document.getElementById('list');
    let tabs = await browser.tabs.query({});
    for (let i = 0; i < tabs.length; ++i) {
        let p = document.createElement('p');
        p.appendChild(document.createTextNode(JSON.stringify(tabs[i])));
        list.appendChild(p);
    }
    if (tabListTabId) {
        browser.tabs.update(tabListTabId, {active:true, highlighted:true});
    }
}

async function init() {
    let tab = await browser.tabs.getCurrent();
    tabListTabId = tab.id;
    listTabs();
}

init();
