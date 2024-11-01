# tabsync

Sync open tabs with other devices seamlessly.


## How to use
* Create a new project on [Supabase](https://supabase.com/)
* Copy project ID and anon key
* Create a new table `tabs` with the following schema:
```
create table
  public.tabs (
    "sharedId" text not null,
    "tabJson" json not null,
    constraint tabs_pkey primary key ("sharedId")
  ) tablespace pg_default;
```
* Set policy to allow this anon key to have all access (because I'm too lazy to setup proper auth):
```
alter policy "Enable full access for all users"
on "public"."tabs"
to public
using ( true );
```
* Install this extension (go to `about:debugging` > This Firefox > Load Temporary Add-on...)
* Click on the extension icon and persist Supabase project ID and anon key
* Click on full sync button to do the initial sync

## Scratch board
Maybe in the future I can connect this extension directly to Sidebery?
```
browser.runtime.connect('{3c078156-979c-498b-8990-85f7987dd929}', {name: '{"srcType":2,"dstType":0,"srcWinId":933}'})
await getSideberyState().Snapshots.createSnapshot()
snaps = await getSideberyState().Snapshots.getStoredSnapshots()
snap = await getSideberyState().Snapshots.getNormalizedSnapshot(snaps, snaps.length - 1)
await getSideberyState().Snapshots.openWindows(snap, windowId)
```

## References

- used [https://github.com/conceptualspace/tablist](tablist) addon as starting point
- about:debugging
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/onUpdated
- https://stackoverflow.com/a/21131034
