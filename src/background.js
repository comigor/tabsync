// web extensions polyfill for ff/chrome
window.browser = (() => {
    return window.browser || window.chrome;
})();

let supabaseProjectId = '';
let apiKey = '';

async function syncLocalToRemote(localTab) {
    if (localTab.url.startsWith('https')) {
        let remoteId = await browser.sessions.getTabValue(localTab.id, 'remoteId');

        let response = await fetch(`https://${supabaseProjectId}.supabase.co/rest/v1/tabs${remoteId ? ('?remoteId=eq.' + remoteId) : ''}`, {
            method: remoteId ? 'PATCH' : 'POST',
            headers: {
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                // 'Prefer': 'return=representation; resolution=merge-duplicates',
                'Prefer': 'return=representation',
            },
            body: JSON.stringify({
                'url': localTab.url,
                'title': localTab.title,
                'pinned': localTab.pinned,
                'openerTabId': localTab.openerTabId,
            }),
        });
        console.debug(response);
        let j = await response.json();
        console.debug(j);
        let remoteTab = j[0];
        await browser.sessions.setTabValue(localTab.id, 'remoteId', remoteTab.remoteId);
    }
}

async function syncRemoteToLocal(remoteTab) {
    let localTabs = await browser.tabs.query({});
    let exists = localTabs.find(async (t) => (await browser.sessions.getTabValue(t.id, 'remoteId')) === remoteTab.remoteId);
    if (!exists) {
        let localTab = await browser.tabs.create({
            url: remoteTab.url,
            pinned: remoteTab.pinned,
            // discarded: true,
            openerTabId: remoteTab.openerTabId,
        });
        await browser.sessions.setTabValue(localTab.id, 'remoteId', remoteTab.remoteId);
    }
}

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url.startsWith('https')) {
        await syncLocalToRemote(tab);
    }
});

browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    let remoteId = await browser.sessions.getTabValue(tabId, 'remoteId');
    await fetch(`https://${supabaseProjectId}.supabase.co/rest/v1/tabs?remoteId=eq.${remoteId}`, {
        method: 'DELETE',
        headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
            // 'Prefer': 'return=minimal',
        },
    });
});

async function fullSync() {
    // full sync
    let localTabs = await browser.tabs.query({});
    console.log(localTabs);

    let response = await fetch(`https://${supabaseProjectId}.supabase.co/rest/v1/tabs`, {
        headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
        },
    });
    let remoteTabs = await response.json();
    console.log(remoteTabs);

    for (let index = 0; index < remoteTabs.length; index++) {
        const remoteTab = remoteTabs[index];
        await syncRemoteToLocal(remoteTab);
    }

    for (let index = 0; index < localTabs.length; index++) {
        const localTab = localTabs[index];
        await syncLocalToRemote(localTab);
    }
}

browser.browserAction.onClicked.addListener(async () => {
    // browser.tabs.create({
    //     url: 'tabsync.html'
    // });
    await fullSync();
});

async function init() {
    // await fullSync();
}

init();
