let supabaseProjectId = '';
let supabaseApiKey = '';
let cacheId = {};
let cacheSharedId = {};
let supabaseCli;

async function loadCredentials() {
    let result = await browser.storage.sync.get(['supabaseProjectId', 'supabaseApiKey']);
    supabaseProjectId = result.supabaseProjectId;
    supabaseApiKey = result.supabaseApiKey;
}

async function syncLocalToRemote(localTab, force = false) {
    let sharedId = await browser.sessions.getTabValue(localTab.id, 'sharedId');
    if (sharedId) {
        if (cacheSharedId[sharedId].url == localTab.url && !force) return;
    } else {
        sharedId = crypto.randomUUID();
        await browser.sessions.setTabValue(localTab.id, 'sharedId', sharedId);
    }

    console.log(`syncLocalToRemote: ${sharedId}`);
    console.log(localTab);

    await supabaseCli
        .from('tabs')
        .upsert({
            'sharedId': sharedId,
            'url': localTab.url,
            'title': localTab.title,
            'pinned': localTab.pinned,
            'openerTabId': localTab.openerTabId,
        })

    await cacheTab(localTab);
}

async function syncRemoteToLocal(remoteTab) {
    console.log(`syncRemoteToLocal: ${remoteTab.sharedId}`);
    console.log(remoteTab);

    if (cacheSharedId[remoteTab.sharedId]) {
        // TODO: update
    } else {
        let localTab = await browser.tabs.create({
            url: remoteTab.url,
            pinned: remoteTab.pinned,
            // discarded: true,
            // openerTabId: remoteTab.openerTabId,
        });
        await browser.sessions.setTabValue(localTab.id, 'sharedId', remoteTab.sharedId);
        await cacheTab(localTab);
    }
}

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        await loadCredentials();
        await syncLocalToRemote(tab);
    }
});

browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    let sharedId = cacheId[tabId].sharedId;

    if (sharedId) {
        await loadCredentials();
        console.log(`remove tab: ${sharedId}`);

        await supabaseCli.from('tabs').delete().eq('sharedId', sharedId);

        delete cacheId[tabId];
        delete cacheSharedId[sharedId];
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
        await syncLocalToRemote(localTabs[index], true);
    }

    await fillCache();
}

async function cacheTab(localTab) {
    let tabId = localTab.id;
    let sharedId = await browser.sessions.getTabValue(tabId, 'sharedId');
    
    cacheId[tabId] = localTab;
    cacheId[tabId].sharedId = sharedId;

    cacheSharedId[sharedId] = localTab;
    cacheSharedId[sharedId].sharedId = sharedId;
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

    eval(await (await fetch(browser.runtime.getURL('supabase.js'))).text());
    supabaseCli = supabase.createClient(`https://${supabaseProjectId}.supabase.co`, supabaseApiKey);
    // supabaseCli
    //     .channel('room1')
    //     .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tabs' }, console.log)
    //     .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tabs' }, console.log)
    //     .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tabs' }, console.log)
    //     .subscribe();
}

init();
