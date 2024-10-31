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

// async function syncLocalToRemote(localTab, force = false) {
//     let sharedId = await browser.sessions.getTabValue(localTab.id, 'sharedId');
//     if (sharedId) {
//         if (cacheSharedId[sharedId].url == localTab.url && !force) return;
//     } else {
//         sharedId = crypto.randomUUID();
//         await browser.sessions.setTabValue(localTab.id, 'sharedId', sharedId);
//     }

//     console.log(`syncLocalToRemote: ${sharedId}`);
//     console.log(localTab);

//     await supabaseCli
//         .from('tabs')
//         .upsert({
//             'sharedId': sharedId,
//             'url': localTab.url,
//             'title': localTab.title,
//             'pinned': localTab.pinned,
//             'openerTabId': localTab.openerTabId,
//         })

//     await cacheTab(localTab);
// }

// async function syncRemoteToLocal(remoteTab) {
//     console.log(`syncRemoteToLocal: ${remoteTab.sharedId}`);
//     console.log(remoteTab);

//     if (cacheSharedId[remoteTab.sharedId]) {
//         // TODO: update
//     } else {
//         let localTab = await browser.tabs.create({
//             url: remoteTab.url,
//             pinned: remoteTab.pinned,
//             // discarded: true,
//             // openerTabId: remoteTab.openerTabId,
//         });
//         await browser.sessions.setTabValue(localTab.id, 'sharedId', remoteTab.sharedId);
//         await cacheTab(localTab);
//     }
// }

// browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
//     if (changeInfo.status === 'complete') {
//         await loadCredentials();
//         await syncLocalToRemote(tab);
//     }
// });

// browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
//     // let sharedId = cacheId[tabId].sharedId;

//     // if (sharedId) {
//     //     await loadCredentials();
//     //     console.log(`remove tab: ${sharedId}`);

//     //     await supabaseCli.from('tabs').delete().eq('sharedId', sharedId);

//     //     delete cacheId[tabId];
//     //     delete cacheSharedId[sharedId];
//     // }
// });

// async function cacheTab(localTab) {
//     let tabId = localTab.id;
//     let sharedId = await browser.sessions.getTabValue(tabId, 'sharedId');
    
//     cacheId[tabId] = localTab;
//     cacheId[tabId].sharedId = sharedId;

//     cacheSharedId[sharedId] = localTab;
//     cacheSharedId[sharedId].sharedId = sharedId;
// }

// async function fillCache() {
//     let localTabs = await browser.tabs.query({});
//     for (let index = 0; index < localTabs.length; index++) {
//         await cacheTab(localTabs[index]);
//     }
// }

browser.browserAction.onClicked.addListener(async () => {
    browser.tabs.create({
        url: 'tabsync.html'
    });
});

// browser.runtime.onMessage.addListener(async (data, sender) => {
//     switch (data.type) {
//       case 'callFn': return window[data.fnName].apply(null, data.params || [])
//     }
// });

// async function overwriteRemoteWithLocal() {
//     await loadCredentials();

//     // delete all on remote
//     await supabaseCli.from('tabs').delete().eq('pinned', true);
//     await supabaseCli.from('tabs').delete().eq('pinned', false);

//     let localTabs = await browser.tabs.query({});
//     console.log('local:');
//     console.log(localTabs);

//     for (let index = 0; index < localTabs.length; index++) {
//         await syncLocalToRemote(localTabs[index], true);
//     }
// }

// async function overwriteLocalWithRemote() {
//     await loadCredentials();

//     let localTabs = await browser.tabs.query({});
//     console.log('local:');
//     console.log(localTabs);

//     // delete all on local
//     let tempTab = await browser.tabs.create({});
//     await browser.tabs.remove(localTabs.map((t) => t.id));

//     let remoteTabs = (await supabaseCli.from('tabs').select('*')).data;
//     console.log('remote:');
//     console.log(remoteTabs);

//     for (let index = 0; index < remoteTabs.length; index++) {
//         await syncRemoteToLocal(remoteTabs[index]);
//     }

//     await browser.tabs.remove(tempTab.id);
// }

// async function fullSync() {
//     await loadCredentials();

//     // full sync
//     let localTabs = await browser.tabs.query({});
//     console.log('local:');
//     console.log(localTabs);

//     let remoteTabs = (await supabaseCli.from('tabs').select('*')).data;
//     console.log('remote:');
//     console.log(remoteTabs);

//     for (let index = 0; index < remoteTabs.length; index++) {
//         await syncRemoteToLocal(remoteTabs[index]);
//     }

//     for (let index = 0; index < localTabs.length; index++) {
//         await syncLocalToRemote(localTabs[index], true);
//     }
// }

let cache = newCache({
    listeners: {
        onCreated: onCreatedHandler,
        onUpdated: onUpdatedHandler,
        onRemoved: onRemovedHandler,
    },
    auto: true,
    tabValueKeys: ['sharedId'],
});

async function onCreatedHandler(tab) {
    console.log('on created');
    sharedId = crypto.randomUUID();
    cache.setValue(tab.id, 'sharedId', sharedId);
    console.log(tab);
    console.log('==============');
}

async function onUpdatedHandler(tab, info) {
    if (info.status === 'complete') {
        console.log('on updated');
        console.log(tab);
        console.log(info);
        console.log(cache.getValue(tab.id, 'sharedId'));
        console.log('==============');
    }
}

async function onRemovedHandler(tab, info, values) {
    console.log('on removed');
    console.log(tab);
    console.log(info);
    console.log(values);
    console.log('==============');
}

async function init() {
    // await fillCache();
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
