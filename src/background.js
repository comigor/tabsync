let supabaseProjectId = '';
let supabaseApiKey = '';
let cache = {};

async function loadCredentials() {
    let result = await browser.storage.sync.get(['supabaseProjectId', 'supabaseApiKey']);
    supabaseProjectId = result.supabaseProjectId;
    supabaseApiKey = result.supabaseApiKey;
}

async function syncLocalToRemote(localTab) {
    if (localTab.url.startsWith('https')) {
        let sharedId = await browser.sessions.getTabValue(localTab.id, 'sharedId');
        let response;

        if (sharedId) {
            console.log(`syncLocalToRemote: ${sharedId}`);
            console.log(localTab);
            // update on remote 
            response = await fetch(`https://${supabaseProjectId}.supabase.co/rest/v1/tabs?sharedId=eq.${sharedId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseApiKey,
                    'Authorization': `Bearer ${supabaseApiKey}`,
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
        } else {
            // insert on remote new id
            sharedId = crypto.randomUUID();
            console.log(`syncLocalToRemote: new tab ${sharedId}`);
            console.log(localTab);
            await browser.sessions.setTabValue(localTab.id, 'sharedId', sharedId);

            response = await fetch(`https://${supabaseProjectId}.supabase.co/rest/v1/tabs`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseApiKey,
                    'Authorization': `Bearer ${supabaseApiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    // 'Prefer': 'return=representation; resolution=merge-duplicates',
                    'Prefer': 'return=representation',
                },
                body: JSON.stringify({
                    'sharedId': sharedId,
                    'url': localTab.url,
                    'title': localTab.title,
                    'pinned': localTab.pinned,
                    'openerTabId': localTab.openerTabId,
                }),
            });
        }
        await cacheTab(localTab);
    }
}

async function syncRemoteToLocal(remoteTab) {
    console.log(`syncRemoteToLocal: ${remoteTab.sharedId}`);
    console.log(remoteTab);

    let localTabs = await browser.tabs.query({});
    let exists = localTabs.find(async (t) => (await browser.sessions.getTabValue(t.id, 'sharedId')) === remoteTab.sharedId);
    if (!exists) {
        let localTab = await browser.tabs.create({
            url: remoteTab.url,
            pinned: remoteTab.pinned,
            // discarded: true,
            openerTabId: remoteTab.openerTabId,
        });
        await browser.sessions.setTabValue(localTab.id, 'sharedId', remoteTab.sharedId);
        await cacheTab(localTab);
    }
}

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url.startsWith('https')) {
        await loadCredentials();
        await syncLocalToRemote(tab);
    }
});

browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    let sharedId = cache[tabId].sharedId;

    if (sharedId) {
        await loadCredentials();
        console.log(`remove tab: ${sharedId}`);
        await fetch(`https://${supabaseProjectId}.supabase.co/rest/v1/tabs?sharedId=eq.${sharedId}`, {
            method: 'DELETE',
            headers: {
                'apikey': supabaseApiKey,
                'Authorization': `Bearer ${supabaseApiKey}`,
                // 'Prefer': 'return=minimal',
            },
        });
    }
});

async function fullSync() {
    await loadCredentials();

    // full sync
    let localTabs = await browser.tabs.query({});
    console.log('local:');
    console.log(localTabs);

    let response = await fetch(`https://${supabaseProjectId}.supabase.co/rest/v1/tabs`, {
        headers: {
            'apikey': supabaseApiKey,
            'Authorization': `Bearer ${supabaseApiKey}`,
        },
    });
    let remoteTabs = await response.json();
    console.log('remote:');
    console.log(remoteTabs);

    for (let index = 0; index < remoteTabs.length; index++) {
        await syncRemoteToLocal(remoteTabs[index]);
    }

    for (let index = 0; index < localTabs.length; index++) {
        await syncLocalToRemote(localTabs[index]);
    }

    await fillCache();
}

async function cacheTab(localTab) {
    let tabId = localTab.id;
    cache[tabId] = localTab;
    cache[tabId].sharedId = await browser.sessions.getTabValue(tabId, 'sharedId');
}

async function fillCache() {
    let localTabs = await browser.tabs.query({});
    for (let index = 0; index < localTabs.length; index++) {
        await cacheTab(localTabs[index]);
    }
}

browser.browserAction.onClicked.addListener(async () => {
    browser.tabs.create({
        url: 'tabsync.html'
    });
});

browser.runtime.onMessage.addListener(async (data, sender) => {
    switch (data.type) {
      case 'callFn': return window[data.fnName].apply(null, data.params || [])
    }
});

async function init() {
    await fillCache();
    await loadCredentials();
}

init();
