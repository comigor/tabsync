document.addEventListener('DOMContentLoaded', () => {
    const projectIdInput = document.getElementById('projectId');
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveButton');
    const fullSyncButton = document.getElementById('fullSyncButton');
    const overwriteRemoteButton = document.getElementById('overwriteRemoteButton');
    const overwriteLocalButton = document.getElementById('overwriteLocalButton');

    // Load existing values from storage
    browser.storage.sync.get(['supabaseProjectId', 'supabaseApiKey']).then((result) => {
        projectIdInput.value = result.supabaseProjectId || '';
        apiKeyInput.value = result.supabaseApiKey || '';
    });

    // Save values to storage when the button is clicked
    saveButton.addEventListener('click', () => {
        const projectId = projectIdInput.value;
        const apiKey = apiKeyInput.value;

        browser.storage.sync.set({
            supabaseProjectId: projectId,
            supabaseApiKey: apiKey
        }).then(() => {
            alert('Credentials saved successfully!');
        }).catch((error) => {
            console.error('Error saving credentials:', error);
        });
    });

    fullSyncButton.addEventListener('click', () => {
        browser.runtime.sendMessage({
            type: 'callFn',
            fnName: 'fullSync',
        }).catch((error) => {
            console.error('Error:', error);
        });
    });

    overwriteRemoteButton.addEventListener('click', () => {
        browser.runtime.sendMessage({
            type: 'callFn',
            fnName: 'overwriteRemote',
        }).catch((error) => {
            console.error('Error:', error);
        });
    });
    overwriteLocalButton.addEventListener('click', () => {
        browser.runtime.sendMessage({
            type: 'callFn',
            fnName: 'overwriteLocal',
        }).catch((error) => {
            console.error('Error:', error);
        });
    });
});
