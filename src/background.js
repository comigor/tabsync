let supabaseProjectId = '';
let supabaseApiKey = '';
let supabaseCli;

async function loadCredentials() {
    let result = await browser.storage.sync.get(['supabaseProjectId', 'supabaseApiKey']);
    supabaseProjectId = result.supabaseProjectId;
    supabaseApiKey = result.supabaseApiKey;
}

async function syncLocalToRemote(localTab) {
    if (/^(moz-extension|https?)/.test(localTab.url)) {
        console.log('syncLocalToRemote');
        let sharedId = cache.getValue(localTab.id, 'sharedId');
        if (!sharedId) {
            sharedId = crypto.randomUUID();
            await cache.setValue(localTab.id, 'sharedId', sharedId);
        }
        console.log(localTab, sharedId);

        await supabaseCli
            .from('tabs')
            .upsert({
                'sharedId': sharedId,
                'tabJson': JSON.stringify(localTab, (k, v) => {
                    if (k === 'favIconUrl') return null;
                    return v;
                }),
            });
    }
}

async function syncRemoteToLocal(remoteTab) {
    console.log(`syncRemoteToLocal:`);
    console.log(remoteTab);

    let newTabData = remoteTab.tab;
    // check for existent tab by sharedId
    let existentTab;
    cache.forEach((tab) => {
        if (tab.sharedId === remoteTab.sharedId) return existentTab = tab;
    });

    if (existentTab) {
        await browser.tabs.update(existentTab.id, {
            openerTabId: cache.get(newTabData.openerTabId) ? newTabData.openerTabId : null, // we must check if this ID exists, or else it'll fail
            pinned: newTabData.pinned,
            successorTabId: newTabData.successorTabId,
            url: newTabData.url,
        });
    } else {
        let newTab = await browser.tabs.create({
            discarded: !newTabData.pinned,
            // index: newTabData.index,
            muted: newTabData.muted,
            openerTabId: cache.get(newTabData.openerTabId) ? newTabData.openerTabId : null, // we must check if this ID exists, or else it'll fail
            pinned: newTabData.pinned,
            // title: newTabData.title,
            url: newTabData.url,
            windowId: newTabData.windowId,
        });
        cache.setValue(newTab.id, 'sharedId', remoteTab.sharedId);
    }
}

async function onUpdatedHandler(tab, info) {
    if (info.status === 'complete') {
        console.log(`onUpdated`);
        console.log(tab);
        await loadCredentials();
        await syncLocalToRemote(tab);
    }
}

/// When the tab moves, we need to update the index of all other
/// tabs that are moved as well, and for that we can leverage
/// info.fromIndex and info.toIndex.
async function onMovedHandler(tab, info) {
    await loadCredentials();
    console.log(`onMoved`);
    console.log(tab);
    console.log(info);

    await cache.forEach(async (tab) => {
        if (tab.index >= info.fromIndex && tab.index <= info.toIndex) {
            console.log('updating ' + tab.id);
            await syncLocalToRemote(tab);
        }
    });
}

async function onRemovedHandler(tab, info, values) {
    console.log(`onRemoved:`);
    console.log(tab);
    console.log(values);
    let sharedId = values.sharedId;

    if (sharedId && !values.isForced) {
        await loadCredentials();
        await supabaseCli.from('tabs').delete().eq('sharedId', sharedId);
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

async function overwriteRemote() {
    await loadCredentials();

    // delete all on remote
    await supabaseCli.from('tabs').delete().neq('sharedId', '');

    await cache.forEach(async (tab) => {
        await syncLocalToRemote(tab);
    });
}

async function overwriteLocal() {
    await loadCredentials();

    // get open tabs ids
    let tabIds = []
    await cache.forEach(async (tab) => {
        cache.setValue(tab.id, 'isForced', true); // to avoid deleting on remote
        tabIds.push(tab.id);
    });

    // create temporary tab to avoid closing the window
    let tempTab = await browser.tabs.create({});

    // delete all on local
    await browser.tabs.remove(tabIds);

    let remoteTabs = (await supabaseCli.from('tabs').select('*')).data.map((t) => ({
        sharedId: t.sharedId,
        tab: JSON.parse(t.tabJson),
    }));
    remoteTabs.sort((a, b) => a.tab.index - b.tab.index);
    console.log('remote:');
    console.log(remoteTabs);

    for (let index = 0; index < remoteTabs.length; index++) {
        await syncRemoteToLocal(remoteTabs[index]).catch(console.error);
    }

    // then close the temp
    await browser.tabs.remove(tempTab.id);
}

async function fullSync() {
    await loadCredentials();

    // full sync
    let localTabs = await browser.tabs.query({});
    console.log('local:');
    console.log(localTabs);

    let remoteTabs = (await supabaseCli.from('tabs').select('*')).data;
    console.log('remote:');
    console.log(remoteTabs);

    for (let index = 0; index < remoteTabs.length; index++) {
        await syncRemoteToLocal(remoteTabs[index]);
    }

    for (let index = 0; index < localTabs.length; index++) {
        await syncLocalToRemote(localTabs[index], true);
    }
}

let cache = newCache({
    listeners: {
        onUpdated: onUpdatedHandler,
        onRemoved: onRemovedHandler,
        onMoved: onMovedHandler,
    },
    auto: true,
    tabValueKeys: ['sharedId', 'isForced'],
});

async function init() {
    await loadCredentials();

    await cache.init();

    supabaseCli = supabase.createClient(`https://${supabaseProjectId}.supabase.co`, supabaseApiKey);
    // supabaseCli
    //     .channel('room1')
    //     .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tabs' }, console.log)
    //     .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tabs' }, console.log)
    //     .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tabs' }, console.log)
    //     .subscribe();
}

init();
