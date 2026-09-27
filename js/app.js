/* =========================================================
   SAFE ROUTE - PHASE 1
   FULL COMMUNICATION + MAP + GPS + ROUTE
   UPDATED:
   - Prevent duplicate voice messages
   - Prevent overlapping chat refreshes
   - File preview/download for sender and receiver
   - Voice signed URLs
   - File signed URLs
========================================================= */


/* =========================================================
   CONFIG / SUPABASE
========================================================= */

const CONFIG =
  window.SAFE_ROUTE_CONFIG || {};

const SUPABASE_READY =
  CONFIG.SUPABASE_URL &&
  CONFIG.SUPABASE_ANON_KEY &&
  !CONFIG.SUPABASE_URL.includes("YOUR_") &&
  !CONFIG.SUPABASE_ANON_KEY.includes("YOUR_");


const supabaseClient =
  SUPABASE_READY
    ? window.supabase.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_ANON_KEY
      )
    : null;


/* =========================================================
   HELPERS
========================================================= */

const $ =
  id =>
    document.getElementById(id);


function status(text) {

  if ($("mapStatus")) {

    $("mapStatus").textContent =
      text;

  }

}


function setConnection(
  text,
  type = ""
) {

  if ($("connection")) {

    $("connection").textContent =
      text;

    $("connection").className =
      "badge " + type;

  }

}


/* =========================================================
   SAFE ROUTE ID
========================================================= */

function generateSafeId() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result =
    "SR-";


  for (
    let i = 0;
    i < 5;
    i++
  ) {

    result +=
      chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];

  }


  return result;

}


let mySafeId =
  localStorage.getItem(
    "safe_route_id"
  );


if (!mySafeId) {

  mySafeId =
    generateSafeId();


  localStorage.setItem(
    "safe_route_id",
    mySafeId
  );

}


if ($("mySafeId")) {

  $("mySafeId").textContent =
    mySafeId;

}


/* =========================================================
   USER STATE
========================================================= */

let myUserId =
  null;

let friend =
  null;

let myPosition =
  null;

let userMarker =
  null;

let userCircle =
  null;

let routeLayer =
  null;

let nearbyLayer =
  null;

let messageChannel =
  null;

let callChannel =
  null;

let messagePolling =
  null;

let peer =
  null;

let localStream =
  null;

let recorder =
  null;

let recordedChunks =
  [];

let voiceBlob =
  null;


/* =========================================================
   CHAT LOAD CONTROL
   IMPORTANT:
   Prevents voice messages appearing twice
   because manual refresh + Realtime can happen
   at the same time.
========================================================= */

let messageLoadRunning =
  false;

let messageLoadAgain =
  false;


/* =========================================================
   MAP
========================================================= */

const map =
  L.map("map")
    .setView(
      [17.385, 78.4867],
      12
    );


L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom:
      19,

    attribution:
      '&copy; OpenStreetMap contributors &middot; Sponsored by <a href="https://tastyandcomfort.github.io/T-C/" target="_blank" rel="noopener">Murali Manohar</a>'
  }
).addTo(map);


nearbyLayer =
  L.layerGroup()
    .addTo(map);


/* =========================================================
   GPS
========================================================= */

function locate() {

  if (!navigator.geolocation) {

    status(
      "GPS is not supported."
    );

    return;

  }


  status(
    "Requesting location..."
  );


  navigator.geolocation
    .getCurrentPosition(

      position => {

        myPosition = {

          lat:
            position.coords.latitude,

          lon:
            position.coords.longitude

        };


        if (userMarker) {

          userMarker.setLatLng([
            myPosition.lat,
            myPosition.lon
          ]);

        }

        else {

          userMarker =
            L.marker([
              myPosition.lat,
              myPosition.lon
            ])
              .addTo(map)
              .bindPopup(
                "You are here"
              );

        }


        if (userCircle) {

          userCircle
            .setLatLng([
              myPosition.lat,
              myPosition.lon
            ]);

        }

        else {

          userCircle =
            L.circle(
              [
                myPosition.lat,
                myPosition.lon
              ],
              {

                radius:
                  position.coords.accuracy ||
                  30,

                color:
                  "#55a5ff",

                fillOpacity:
                  0.08

              }
            )
              .addTo(map);

        }


        map.setView(
          [
            myPosition.lat,
            myPosition.lon
          ],
          15
        );


        status(
          "Location found"
        );

      },

      error => {

        console.error(
          "GPS ERROR:",
          error
        );


        status(
          "Location permission denied or unavailable."
        );

      },

      {

        enableHighAccuracy:
          true,

        timeout:
          15000,

        maximumAge:
          30000

      }

    );

}


if ($("locateBtn")) {

  $("locateBtn").onclick =
    locate;

}


/* =========================================================
   COPY SAFE ID
========================================================= */

if ($("copyId")) {

  $("copyId").onclick =
    async () => {

      try {

        await navigator.clipboard
          .writeText(
            mySafeId
          );


        $("copyId").textContent =
          "✓ ID Copied";


        setTimeout(
          () => {

            $("copyId").textContent =
              "📋 Copy my ID";

          },
          1500
        );

      }

      catch {

        alert(
          "Your Safe Route ID: " +
          mySafeId
        );

      }

    };

}


/* =========================================================
   SUPABASE SESSION
========================================================= */

async function startAnonymousSession() {

  if (!supabaseClient) {

    setConnection(
      "Backend needed",
      "warn"
    );


    if ($("connectStatus")) {

      $("connectStatus").textContent =
        "Supabase client was not created.";

    }


    return null;

  }


  try {

    const {
      data: sessionData,
      error: sessionError
    } =
      await supabaseClient.auth
        .getSession();


    if (sessionError) {

      console.error(
        "SESSION ERROR:",
        sessionError
      );

    }


    if (
      sessionData &&
      sessionData.session &&
      sessionData.session.user
    ) {

      const user =
        sessionData.session.user;


      myUserId =
        user.id;


      localStorage.setItem(
        "safe_route_user_id",
        myUserId
      );


      setConnection(
        "Online",
        "ok"
      );


      if ($("connectStatus")) {

        $("connectStatus").textContent =
          "Supabase connected.";

      }


      return user;

    }


    const {
      data,
      error
    } =
      await supabaseClient.auth
        .signInAnonymously();


    if (error) {

      console.error(
        "ANONYMOUS LOGIN ERROR:",
        error
      );


      setConnection(
        "Backend error",
        "warn"
      );


      if ($("connectStatus")) {

        $("connectStatus").textContent =
          "Supabase: " +
          error.message;

      }


      return null;

    }


    if (
      !data ||
      !data.user
    ) {

      setConnection(
        "Backend error",
        "warn"
      );


      if ($("connectStatus")) {

        $("connectStatus").textContent =
          "Supabase did not return a user.";

      }


      return null;

    }


    myUserId =
      data.user.id;


    localStorage.setItem(
      "safe_route_user_id",
      myUserId
    );


    setConnection(
      "Online",
      "ok"
    );


    if ($("connectStatus")) {

      $("connectStatus").textContent =
        "Supabase connected.";

    }


    return data.user;

  }

  catch (error) {

    console.error(
      "SUPABASE EXCEPTION:",
      error
    );


    setConnection(
      "Backend error",
      "warn"
    );


    if ($("connectStatus")) {

      $("connectStatus").textContent =
        "Supabase: " +
        error.message;

    }


    return null;

  }

}


/* =========================================================
   REGISTER SAFE ID
========================================================= */

async function registerSafeId() {

  if (!supabaseClient) {

    return;

  }


  const user =
    await startAnonymousSession();


  if (!user) {

    return;

  }


  myUserId =
    user.id;


  console.log(
    "CURRENT SUPABASE USER:",
    myUserId
  );


  const {
    data: existingUser,
    error: findError
  } =
    await supabaseClient
      .from("safe_users")
      .select(
        "id,safe_id"
      )
      .eq(
        "id",
        myUserId
      )
      .maybeSingle();


  if (findError) {

    console.error(
      "SAFE USER LOOKUP ERROR:",
      findError
    );

  }


  if (existingUser) {

    mySafeId =
      existingUser.safe_id;


    localStorage.setItem(
      "safe_route_id",
      mySafeId
    );


    if ($("mySafeId")) {

      $("mySafeId").textContent =
        mySafeId;

    }

  }

  else {

    const {
      error: insertError
    } =
      await supabaseClient
        .from("safe_users")
        .insert({

          id:
            myUserId,

          safe_id:
            mySafeId,

          last_seen:
            new Date().toISOString()

        });


    if (insertError) {

      if (
        insertError.code ===
        "23505"
      ) {

        mySafeId =
          generateSafeId();


        localStorage.setItem(
          "safe_route_id",
          mySafeId
        );


        if ($("mySafeId")) {

          $("mySafeId").textContent =
            mySafeId;

        }


        const retry =
          await supabaseClient
            .from("safe_users")
            .insert({

              id:
                myUserId,

              safe_id:
                mySafeId,

              last_seen:
                new Date().toISOString()

            });


        if (retry.error) {

          console.error(
            "SAFE ID RETRY ERROR:",
            retry.error
          );

        }

      }

      else {

        console.error(
          "SAFE ID INSERT ERROR:",
          insertError
        );

      }

    }

  }


  await supabaseClient
    .from("safe_users")
    .update({

      last_seen:
        new Date().toISOString()

    })
    .eq(
      "id",
      myUserId
    );


  subscribeMessages();

  subscribeCalls();

}


/* =========================================================
   CONNECT TO USER
========================================================= */

if ($("connectBtn")) {

  $("connectBtn").onclick =
    connectToUser;

}


async function connectToUser() {

  const id =
    $("friendId")
      .value
      .trim()
      .toUpperCase();


  if (!id) {

    $("connectStatus").textContent =
      "Enter a Safe Route ID.";

    return;

  }


  if (id === mySafeId) {

    $("connectStatus").textContent =
      "You cannot connect to your own ID.";

    return;

  }


  if (!supabaseClient) {

    $("connectStatus").textContent =
      "Configure Supabase first.";

    return;

  }


  if (!myUserId) {

    const user =
      await startAnonymousSession();


    if (!user) {

      return;

    }

  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from("safe_users")
      .select(
        "id,safe_id"
      )
      .eq(
        "safe_id",
        id
      )
      .maybeSingle();


  if (error) {

    console.error(
      "CONNECT ERROR:",
      error
    );


    $("connectStatus").textContent =
      "Connect error: " +
      error.message;

    return;

  }


  if (!data) {

    $("connectStatus").textContent =
      "User not found or not registered.";

    return;

  }


  friend = {

    id:
      data.id,

    safe_id:
      data.safe_id

  };


  if ($("chatName")) {

    $("chatName").textContent =
      "Connected to " +
      friend.safe_id;

  }


  $("connectStatus").textContent =
    "✓ Connected";


  await loadMessages();


  startMessagePolling();

}


/* =========================================================
   MESSAGE POLLING
========================================================= */

function startMessagePolling() {

  if (messagePolling) {

    clearInterval(
      messagePolling
    );

  }


  messagePolling =
    setInterval(
      () => {

        if (
          friend &&
          supabaseClient &&
          myUserId
        ) {

          loadMessages();

        }

      },
      2000
    );

}


/* =========================================================
   SEND TEXT MESSAGE
========================================================= */

if ($("send")) {

  $("send").onclick =
    sendMessage;

}


async function sendMessage() {

  if (!friend) {

    alert(
      "Connect to a Safe Route user first."
    );

    return;

  }


  if (!myUserId) {

    alert(
      "Supabase user session is not ready."
    );

    return;

  }


  const input =
    $("message");


  const message =
    input.value.trim();


  if (!message) {

    return;

  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from("safe_messages")
      .insert({

        sender_id:
          myUserId,

        receiver_id:
          friend.id,

        message_type:
          "text",

        content:
          message

      })
      .select()
      .single();


  if (error) {

    console.error(
      "SEND ERROR:",
      error
    );


    $("connectStatus").textContent =
      "Send error: " +
      error.message;

    return;

  }


  console.log(
    "MESSAGE SAVED:",
    data
  );


  input.value =
    "";


  await loadMessages();


  $("connectStatus").textContent =
    "Message sent";

}


/* =========================================================
   LOAD MESSAGES
   FIXED:
   - No overlapping loads
   - No duplicate voice messages
   - No duplicate file messages
========================================================= */

async function loadMessages() {

  if (messageLoadRunning) {

    messageLoadAgain =
      true;

    return;

  }


  if (
    !friend ||
    !supabaseClient ||
    !myUserId
  ) {

    return;

  }


  messageLoadRunning =
    true;


  try {

    console.log(
      "LOADING CHAT:",
      {
        myUserId,
        friendId:
          friend.id
      }
    );


    const {
      data,
      error
    } =
      await supabaseClient
        .from("safe_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${myUserId},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${myUserId})`
        )
        .order(
          "created_at",
          {
            ascending:
              true
          }
        );


    if (error) {

      console.error(
        "LOAD MESSAGE ERROR:",
        error
      );


      if ($("connectStatus")) {

        $("connectStatus").textContent =
          "Message error: " +
          error.message;

      }


      return;

    }


    const messagesBox =
      $("messages");


    if (!messagesBox) {

      return;

    }


    /*
      Clear only after successful
      database response.
    */

    messagesBox.innerHTML =
      "";


    if (
      !data ||
      data.length === 0
    ) {

      messagesBox.innerHTML =
        `<div class="muted">
          No messages yet.
        </div>`;


      if ($("connectStatus")) {

        $("connectStatus").textContent =
          "Messages loaded: 0";

      }


      return;

    }


    /*
      Remove duplicate database rows
      by message ID.
    */

    const uniqueMessages =
      [];

    const seenIds =
      new Set();


    for (
      const message of data
    ) {

      if (
        message.id &&
        seenIds.has(
          message.id
        )
      ) {

        console.warn(
          "DUPLICATE MESSAGE IGNORED:",
          message.id
        );

        continue;

      }


      if (message.id) {

        seenIds.add(
          message.id
        );

      }


      uniqueMessages.push(
        message
      );

    }


    /*
      Display one at a time.

      This is important because voice/file
      messages require signed URL requests.
    */

    for (
      const message of uniqueMessages
    ) {

      await displayMessage(
        message
      );

    }


    /*
      Scroll after the complete chat
      has finished rendering.
    */

    messagesBox.scrollTop =
      messagesBox.scrollHeight;


    if ($("connectStatus")) {

      $("connectStatus").textContent =
        "Messages loaded: " +
        uniqueMessages.length;

    }

  }

  catch (error) {

    console.error(
      "LOAD EXCEPTION:",
      error
    );


    if ($("connectStatus")) {

      $("connectStatus").textContent =
        "Message error: " +
        error.message;

    }

  }

  finally {

    messageLoadRunning =
      false;


    /*
      If Realtime requested another
      refresh while this load was running,
      do exactly one more refresh.
    */

    if (messageLoadAgain) {

      messageLoadAgain =
        false;


      setTimeout(
        () => {

          loadMessages();

        },
        100
      );

    }

  }

}


/* =========================================================
   DISPLAY MESSAGE
   TEXT + LOCATION + VOICE + FILE
========================================================= */

async function displayMessage(
  message
) {

  const div =
    document.createElement("div");


  const isMine =
    message.sender_id ===
    myUserId;


  div.className =
    "bubble " +
    (
      isMine
        ? "me"
        : "them"
    );


  /*
    Use data-message-id so an extra
    safety check can be performed.
  */

  if (message.id) {

    div.dataset.messageId =
      message.id;

  }


  /* =======================================================
     LOCATION
  ======================================================= */

  if (
    message.message_type ===
    "location"
  ) {

    const link =
      document.createElement("a");


    link.href =
      `https://www.openstreetmap.org/?mlat=${message.latitude}&mlon=${message.longitude}`;


    link.target =
      "_blank";


    link.rel =
      "noopener";


    link.style.color =
      "white";


    link.textContent =
      "📍 Shared location";


    div.appendChild(
      link
    );

  }


  /* =======================================================
     VOICE
  ======================================================= */

  else if (
    message.message_type ===
    "voice"
  ) {

    const title =
      document.createElement("div");


    title.textContent =
      "🎙️ Voice message";


    title.style.fontWeight =
      "700";


    title.style.marginBottom =
      "6px";


    div.appendChild(
      title
    );


    if (
      message.media_path &&
      supabaseClient
    ) {

      const audio =
        document.createElement("audio");


      audio.controls =
        true;


      audio.preload =
        "metadata";


      audio.className =
        "audio";


      audio.style.width =
        "100%";


      const {
        data,
        error
      } =
        await supabaseClient
          .storage
          .from(
            "voice-messages"
          )
          .createSignedUrl(
            message.media_path,
            3600
          );


      if (error) {

        console.error(
          "VOICE URL ERROR:",
          error
        );


        const errorText =
          document.createElement("div");


        errorText.textContent =
          "⚠️ Voice unavailable";


        errorText.style.fontSize =
          "11px";


        div.appendChild(
          errorText
        );

      }

      else if (
        data &&
        data.signedUrl
      ) {

        audio.src =
          data.signedUrl;


        audio.onloadedmetadata =
          () => {

            console.log(
              "VOICE DURATION:",
              audio.duration,
              "seconds"
            );

          };


        audio.onerror =
          event => {

            console.error(
              "AUDIO PLAY ERROR:",
              event
            );

          };


        div.appendChild(
          audio
        );

      }

    }

  }


  /* =======================================================
     FILE
  ======================================================= */

  else if (
    message.message_type ===
    "file"
  ) {

    const fileBox =
      document.createElement("div");


    fileBox.style.display =
      "flex";


    fileBox.style.alignItems =
      "center";


    fileBox.style.gap =
      "8px";


    const icon =
      document.createElement("span");


    icon.textContent =
      "📎";


    icon.style.fontSize =
      "22px";


    fileBox.appendChild(
      icon
    );


    const fileInfo =
      document.createElement("div");


    fileInfo.style.flex =
      "1";


    const fileName =
      document.createElement("div");


    fileName.textContent =
      message.content ||
      "Shared file";


    fileName.style.fontWeight =
      "700";


    fileName.style.wordBreak =
      "break-word";


    fileInfo.appendChild(
      fileName
    );


    /*
      Create temporary signed URL.

      This works for PRIVATE buckets and
      allows BOTH sender and receiver to
      open/download the file.
    */

    if (
      message.media_path &&
      supabaseClient
    ) {

      const {
        data,
        error
      } =
        await supabaseClient
          .storage
          .from(
            "shared-files"
          )
          .createSignedUrl(
            message.media_path,
            3600
          );


      if (error) {

        console.error(
          "FILE URL ERROR:",
          error
        );


        const unavailable =
          document.createElement("small");


        unavailable.textContent =
          "⚠️ File unavailable";


        unavailable.style.display =
          "block";


        unavailable.style.marginTop =
          "4px";


        fileInfo.appendChild(
          unavailable
        );

      }

      else if (
        data &&
        data.signedUrl
      ) {

        /*
          Detect common previewable files.
        */

        const fileNameLower =
          (
            message.content ||
            ""
          ).toLowerCase();


        const imageFile =
          /\.(jpg|jpeg|png|gif|webp|bmp)$/i
            .test(
              fileNameLower
            );


        const videoFile =
          /\.(mp4|webm|mov|m4v)$/i
            .test(
              fileNameLower
            );


        const audioFile =
          /\.(mp3|wav|ogg|m4a|aac|webm)$/i
            .test(
              fileNameLower
            );


        /*
          IMAGE PREVIEW
        */

        if (imageFile) {

          const image =
            document.createElement(
              "img"
            );


          image.src =
            data.signedUrl;


          image.alt =
            message.content ||
            "Shared image";


          image.style.maxWidth =
            "100%";


          image.style.maxHeight =
            "250px";


          image.style.borderRadius =
            "10px";


          image.style.marginTop =
            "6px";


          image.style.display =
            "block";


          fileInfo.appendChild(
            image
          );

        }


        /*
          VIDEO PREVIEW
        */

        else if (videoFile) {

          const video =
            document.createElement(
              "video"
            );


          video.src =
            data.signedUrl;


          video.controls =
            true;


          video.preload =
            "metadata";


          video.style.width =
            "100%";


          video.style.maxHeight =
            "250px";


          video.style.marginTop =
            "6px";


          fileInfo.appendChild(
            video
          );

        }


        /*
          AUDIO PREVIEW
        */

        else if (audioFile) {

          const audio =
            document.createElement(
              "audio"
            );


          audio.src =
            data.signedUrl;


          audio.controls =
            true;


          audio.preload =
            "metadata";


          audio.style.width =
            "100%";


          audio.style.marginTop =
            "6px";


          fileInfo.appendChild(
            audio
          );

        }


        /*
          OPEN / DOWNLOAD
        */

        const download =
          document.createElement(
            "a"
          );


        download.href =
          data.signedUrl;


        download.target =
          "_blank";


        download.rel =
          "noopener";


        download.textContent =
          "⬇️ Open / Download";


        download.style.display =
          "inline-block";


        download.style.marginTop =
          "6px";


        download.style.color =
          "white";


        download.style.fontSize =
          "12px";


        download.style.textDecoration =
          "underline";


        fileInfo.appendChild(
          download
        );

      }

    }


    fileBox.appendChild(
      fileInfo
    );


    div.appendChild(
      fileBox
    );

  }


  /* =======================================================
     TEXT
  ======================================================= */

  else {

    div.textContent =
      message.content ||
      "";

  }


  /* =======================================================
     TIME
  ======================================================= */

  const time =
    document.createElement(
      "time"
    );


  const date =
    new Date(
      message.created_at
    );


  time.textContent =
    date.toLocaleTimeString(
      [],
      {

        hour:
          "2-digit",

        minute:
          "2-digit"

      }
    );


  div.appendChild(
    time
  );


  /*
    Final safety check:
    Don't add the same message ID
    if it somehow already exists.
  */

  if (
    message.id &&
    $("messages")
      .querySelector(
        `[data-message-id="${message.id}"]`
      )
  ) {

    console.warn(
      "MESSAGE ALREADY DISPLAYED:",
      message.id
    );

    return;

  }


  $("messages")
    .appendChild(
      div
    );


  console.log(
    "DISPLAYED MESSAGE:",
    {

      id:
        message.id,

      type:
        message.message_type,

      sender:
        message.sender_id,

      receiver:
        message.receiver_id,

      mine:
        isMine,

      media:
        message.media_path,

      content:
        message.content

    }
  );

}


/* =========================================================
   REALTIME MESSAGES
========================================================= */

function subscribeMessages() {

  if (
    !supabaseClient ||
    !myUserId
  ) {

    return;

  }


  if (messageChannel) {

    supabaseClient
      .removeChannel(
        messageChannel
      );

  }


  messageChannel =
    supabaseClient
      .channel(
        "messages-" +
        myUserId +
        "-" +
        Date.now()
      )
      .on(

        "postgres_changes",

        {

          event:
            "INSERT",

          schema:
            "public",

          table:
            "safe_messages"

        },

        payload => {

          console.log(
            "REALTIME NEW MESSAGE:",
            payload.new
          );


          const message =
            payload.new;


          if (
            message.receiver_id ===
              myUserId ||

            message.sender_id ===
              myUserId
          ) {

            /*
              loadMessages() itself prevents
              overlapping refreshes.
            */

            loadMessages();

          }

        }

      )
      .subscribe(
        channelStatus => {

          console.log(
            "MESSAGE REALTIME STATUS:",
            channelStatus
          );

        }
      );

}


/* =========================================================
   LOCATION SHARE
========================================================= */

if ($("shareLocation")) {

  $("shareLocation").onclick =
    async () => {

      if (!friend) {

        alert(
          "Connect to a user first."
        );

        return;

      }


      if (!myPosition) {

        locate();


        alert(
          "Please allow GPS and try again."
        );


        return;

      }


      const {
        error
      } =
        await supabaseClient
          .from("safe_messages")
          .insert({

            sender_id:
              myUserId,

            receiver_id:
              friend.id,

            message_type:
              "location",

            latitude:
              myPosition.lat,

            longitude:
              myPosition.lon

          });


      if (error) {

        if ($("shareStatus")) {

          $("shareStatus").textContent =
            error.message;

        }

        return;

      }


      if ($("shareStatus")) {

        $("shareStatus").textContent =
          "✓ Location shared.";

      }


      await loadMessages();

    };

}


/* =========================================================
   VOICE RECORDING
========================================================= */

if ($("record")) {

  $("record").onclick =
    async () => {

      if (!friend) {

        alert(
          "Connect to a user first."
        );

        return;

      }


      if (
        recorder &&
        recorder.state ===
          "recording"
      ) {

        recorder.stop();

        return;

      }


      try {

        const microphone =
          await navigator
            .mediaDevices
            .getUserMedia({

              audio:
                true

            });


        recordedChunks =
          [];


        recorder =
          new MediaRecorder(
            microphone
          );


        recorder.ondataavailable =
          event => {

            if (
              event.data.size
            ) {

              recordedChunks
                .push(
                  event.data
                );

            }

          };


        recorder.onstop =
          () => {

            microphone
              .getTracks()
              .forEach(
                track =>
                  track.stop()
              );


            voiceBlob =
              new Blob(
                recordedChunks,
                {

                  type:
                    recorder.mimeType

                }
              );


            if ($("preview")) {

              $("preview").src =
                URL.createObjectURL(
                  voiceBlob
                );


              $("preview")
                .classList
                .remove(
                  "hidden"
                );

            }


            if ($("sendVoice")) {

              $("sendVoice")
                .classList
                .remove(
                  "hidden"
                );

            }


            $("record").textContent =
              "🎙️ Start recording";

          };


        recorder.start();


        $("record").textContent =
          "⏹ Stop recording";

      }

      catch (error) {

        alert(
          error.message
        );

      }

    };

}


/* =========================================================
   SEND VOICE
========================================================= */

if ($("sendVoice")) {

  $("sendVoice").onclick =
    async () => {

      if (
        !voiceBlob ||
        !friend
      ) {

        return;

      }


      if (
        !supabaseClient ||
        !myUserId
      ) {

        alert(
          "Supabase session is not ready."
        );

        return;

      }


      try {

        const recordedMimeType =
          voiceBlob.type ||
          "audio/webm";


        const extension =
          recordedMimeType.includes(
            "mp4"
          )

            ? "mp4"

            : recordedMimeType.includes(
                "ogg"
              )

              ? "ogg"

              : "webm";


        const filename =
          myUserId +
          "/" +
          crypto.randomUUID() +
          "." +
          extension;


        if ($("connectStatus")) {

          $("connectStatus").textContent =
            "Uploading voice...";

        }


        const upload =
          await supabaseClient
            .storage
            .from(
              "voice-messages"
            )
            .upload(
              filename,
              voiceBlob,
              {

                contentType:
                  recordedMimeType,

                upsert:
                  false

              }
            );


        if (upload.error) {

          console.error(
            "VOICE UPLOAD ERROR:",
            upload.error
          );


          if ($("connectStatus")) {

            $("connectStatus").textContent =
              "Voice upload error: " +
              upload.error.message;

          }


          return;

        }


        const {
          error
        } =
          await supabaseClient
            .from("safe_messages")
            .insert({

              sender_id:
                myUserId,

              receiver_id:
                friend.id,

              message_type:
                "voice",

              media_path:
                filename

            });


        if (error) {

          console.error(
            "VOICE MESSAGE ERROR:",
            error
          );


          if ($("connectStatus")) {

            $("connectStatus").textContent =
              "Voice message error: " +
              error.message;

          }


          return;

        }


        voiceBlob =
          null;


        if ($("preview")) {

          $("preview")
            .classList
            .add(
              "hidden"
            );

          $("preview").src =
            "";

        }


        if ($("sendVoice")) {

          $("sendVoice")
            .classList
            .add(
              "hidden"
            );

        }


        if ($("connectStatus")) {

          $("connectStatus").textContent =
            "✓ Voice sent";

        }


        /*
          Safe because loadMessages()
          prevents overlapping refreshes.
        */

        await loadMessages();

      }

      catch (error) {

        console.error(
          "VOICE SEND ERROR:",
          error
        );


        if ($("connectStatus")) {

          $("connectStatus").textContent =
            "Voice error: " +
            error.message;

        }

      }

    };

}


/* =========================================================
   SHARE FILE
========================================================= */

if ($("shareFile")) {

  $("shareFile").onclick =
    () => {

      if (!friend) {

        alert(
          "Connect to a user first."
        );

        return;

      }


      if ($("fileInput")) {

        $("fileInput").click();

      }

    };

}


if ($("fileInput")) {

  $("fileInput").onchange =
    async () => {

      const file =
        $("fileInput").files[0];


      if (!file) {

        return;

      }


      if (!friend) {

        alert(
          "Connect to a user first."
        );


        $("fileInput").value =
          "";


        return;

      }


      if (
        !supabaseClient ||
        !myUserId
      ) {

        alert(
          "Supabase session is not ready."
        );


        $("fileInput").value =
          "";


        return;

      }


      /*
        Maximum 25 MB.
      */

      const maxSize =
        25 *
        1024 *
        1024;


      if (
        file.size >
        maxSize
      ) {

        alert(
          "File is too large. Maximum size is 25 MB."
        );


        $("fileInput").value =
          "";


        return;

      }


      if ($("connectStatus")) {

        $("connectStatus").textContent =
          "Uploading " +
          file.name +
          "...";

      }


      try {

        const safeName =
          file.name
            .replace(
              /[^a-zA-Z0-9._-]/g,
              "_"
            );


        const filePath =
          myUserId +
          "/" +
          crypto.randomUUID() +
          "-" +
          safeName;


        /*
          Upload to shared-files bucket.
        */

        const upload =
          await supabaseClient
            .storage
            .from(
              "shared-files"
            )
            .upload(
              filePath,
              file,
              {

                contentType:
                  file.type ||
                  "application/octet-stream",

                upsert:
                  false

              }
            );


        if (upload.error) {

          console.error(
            "FILE UPLOAD ERROR:",
            upload.error
          );


          if ($("connectStatus")) {

            $("connectStatus").textContent =
              "File upload error: " +
              upload.error.message;

          }


          return;

        }


        /*
          Save message record.
        */

        const {
          error
        } =
          await supabaseClient
            .from("safe_messages")
            .insert({

              sender_id:
                myUserId,

              receiver_id:
                friend.id,

              message_type:
                "file",

              content:
                file.name,

              media_path:
                filePath

            });


        if (error) {

          console.error(
            "FILE MESSAGE ERROR:",
            error
          );


          if ($("connectStatus")) {

            $("connectStatus").textContent =
              "File message error: " +
              error.message;

          }


          return;

        }


        $("fileInput").value =
          "";


        if ($("connectStatus")) {

          $("connectStatus").textContent =
            "✓ File shared";

        }


        await loadMessages();

      }

      catch (error) {

        console.error(
          "FILE SHARE ERROR:",
          error
        );


        if ($("connectStatus")) {

          $("connectStatus").textContent =
            "File error: " +
            error.message;

        }

      }

    };

}


/* =========================================================
   VOICE CALL
========================================================= */

async function startCall() {

  if (!friend) {

    alert(
      "Connect to a user first."
    );

    return;

  }


  try {

    localStream =
      await navigator
        .mediaDevices
        .getUserMedia({

          audio:
            true

        });


    peer =
      new RTCPeerConnection({

        iceServers: [

          {

            urls:
              "stun:stun.l.google.com:19302"

          }

        ]

      });


    localStream
      .getTracks()
      .forEach(
        track =>
          peer.addTrack(
            track,
            localStream
          )
      );


    peer.ontrack =
      event => {

        if ($("remoteAudio")) {

          $("remoteAudio")
            .srcObject =
            event.streams[0];

        }

      };


    peer.onicecandidate =
      event => {

        if (
          event.candidate
        ) {

          sendCallSignal({

            type:
              "ice",

            candidate:
              event.candidate

          });

        }

      };


    const offer =
      await peer
        .createOffer();


    await peer
      .setLocalDescription(
        offer
      );


    await sendCallSignal({

      type:
        "offer",

      sdp:
        offer.sdp

    });


    if ($("callStatus")) {

      $("callStatus").textContent =
        "Calling...";

    }

  }

  catch (error) {

    if ($("callStatus")) {

      $("callStatus").textContent =
        error.message;

    }

  }

}


if ($("call")) {

  $("call").onclick =
    startCall;

}


/* =========================================================
   CALL SIGNAL
========================================================= */

async function sendCallSignal(
  signal
) {

  if (
    !friend ||
    !supabaseClient ||
    !myUserId
  ) {

    return;

  }


  const {
    error
  } =
    await supabaseClient
      .from(
        "safe_call_signals"
      )
      .insert({

        sender_id:
          myUserId,

        receiver_id:
          friend.id,

        signal:
          signal

      });


  if (error) {

    console.error(
      "CALL SIGNAL ERROR:",
      error
    );

  }

}


/* =========================================================
   CALL REALTIME
========================================================= */

function subscribeCalls() {

  if (
    !supabaseClient ||
    !myUserId
  ) {

    return;

  }


  if (callChannel) {

    supabaseClient
      .removeChannel(
        callChannel
      );

  }


  callChannel =
    supabaseClient
      .channel(
        "safe-calls-" +
        myUserId +
        "-" +
        Date.now()
      )
      .on(

        "postgres_changes",

        {

          event:
            "INSERT",

          schema:
            "public",

          table:
            "safe_call_signals"

        },

        async payload => {

          const signal =
            payload.new;


          if (
            signal.receiver_id !==
            myUserId
          ) {

            return;

          }


          await handleCallSignal(
            signal.signal,
            signal.sender_id
          );

        }

      )
      .subscribe(
        callStatus => {

          console.log(
            "CALL REALTIME:",
            callStatus
          );

        }
      );

}


/* =========================================================
   HANDLE CALL
========================================================= */

async function handleCallSignal(
  signal,
  senderId
) {

  if (
    signal.type ===
    "offer"
  ) {

    friend = {

      id:
        senderId

    };


    if (!peer) {

      localStream =
        await navigator
          .mediaDevices
          .getUserMedia({

            audio:
              true

          });


      peer =
        new RTCPeerConnection({

          iceServers: [

            {

              urls:
                "stun:stun.l.google.com:19302"

            }

          ]

        });


      localStream
        .getTracks()
        .forEach(
          track =>
            peer.addTrack(
              track,
              localStream
            )
        );


      peer.ontrack =
        event => {

          if ($("remoteAudio")) {

            $("remoteAudio")
              .srcObject =
              event.streams[0];

          }

        };


      peer.onicecandidate =
        event => {

          if (
            event.candidate
          ) {

            sendCallSignal({

              type:
                "ice",

              candidate:
                event.candidate

            });

          }

        };

    }


    await peer
      .setRemoteDescription({

        type:
          "offer",

        sdp:
          signal.sdp

      });


    const answer =
      await peer
        .createAnswer();


    await peer
      .setLocalDescription(
        answer
      );


    await supabaseClient
      .from(
        "safe_call_signals"
      )
      .insert({

        sender_id:
          myUserId,

        receiver_id:
          senderId,

        signal: {

          type:
            "answer",

          sdp:
            answer.sdp

        }

      });


    if ($("callStatus")) {

      $("callStatus").textContent =
        "Incoming call connected.";

    }

  }


  else if (
    signal.type ===
      "answer" &&
    peer
  ) {

    await peer
      .setRemoteDescription({

        type:
          "answer",

        sdp:
          signal.sdp

      });


    if ($("callStatus")) {

      $("callStatus").textContent =
        "Call connected.";

    }

  }


  else if (
    signal.type ===
      "ice" &&
    peer
  ) {

    try {

      await peer
        .addIceCandidate(
          signal.candidate
        );

    }

    catch (error) {

      console.error(
        "ICE ERROR:",
        error
      );

    }

  }

}


/* =========================================================
   HANG UP
========================================================= */

if ($("hangup")) {

  $("hangup").onclick =
    () => {

      if (peer) {

        peer.close();

        peer =
          null;

      }


      if (localStream) {

        localStream
          .getTracks()
          .forEach(
            track =>
              track.stop()
          );

        localStream =
          null;

      }


      if ($("remoteAudio")) {

        $("remoteAudio")
          .srcObject =
          null;

      }


      if ($("callStatus")) {

        $("callStatus").textContent =
          "No active call.";

      }

    };

}


/* =========================================================
   COMMUNICATION TABS
========================================================= */

document
  .querySelectorAll(
    ".tab"
  )
  .forEach(
    button => {

      button.onclick =
        () => {

          document
            .querySelectorAll(
              ".tab"
            )
            .forEach(
              b =>
                b.classList
                  .remove(
                    "active"
                  )
            );


          button
            .classList
            .add(
              "active"
            );


          document
            .querySelectorAll(
              ".panel"
            )
            .forEach(
              panel =>
                panel.classList
                  .add(
                    "hidden"
                  )
            );


          const panel =
            $(
              button.dataset.tab +
              "Panel"
            );


          if (panel) {

            panel.classList
              .remove(
                "hidden"
              );

          }

        };

    }
  );


/* =========================================================
   ROUTE ADVISORY
========================================================= */

async function geocode(
  query
) {

  const response =
    await fetch(
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
      encodeURIComponent(
        query
      )
    );


  const results =
    await response.json();


  if (!results.length) {

    throw new Error(
      "Destination not found."
    );

  }


  return {

    lat:
      Number(
        results[0].lat
      ),

    lon:
      Number(
        results[0].lon
      ),

    name:
      results[0]
        .display_name

  };

}


if ($("route")) {

  $("route").onclick =
    async () => {

      if (!myPosition) {

        locate();

        return;

      }


      const destination =
        $("destination")
          .value
          .trim();


      if (!destination) {

        return;

      }


      $("routeState")
        .textContent =
        "Planning...";


      try {

        const place =
          await geocode(
            destination
          );


        const response =
          await fetch(
            `https://router.project-osrm.org/route/v1/driving/${myPosition.lon},${myPosition.lat};${place.lon},${place.lat}?overview=full&geometries=geojson`
          );


        const data =
          await response.json();


        if (
          !data.routes ||
          !data.routes.length
        ) {

          throw new Error(
            "Route not found."
          );

        }


        const route =
          data.routes[0];


        if (routeLayer) {

          map.removeLayer(
            routeLayer
          );

        }


        routeLayer =
          L.geoJSON(
            route.geometry,
            {

              style: {

                color:
                  "#55a5ff",

                weight:
                  6

              }

            }
          )
            .addTo(map);


        map.fitBounds(
          routeLayer.getBounds(),
          {

            padding:
              [25, 25]

          }
        );


        const km =
          route.distance /
          1000;


        const minutes =
          Math.round(
            route.duration /
            60
          );


        const timeText =
          minutes < 60

            ? minutes +
              " min"

            : Math.floor(
                minutes / 60
              ) +
              " hr " +
              (
                minutes % 60
              ) +
              " min";


        $("routeInfo")
          .innerHTML =

          `<div class="stats">

            <div class="stat">

              <b>
                ${km.toFixed(1)} km
              </b>

              <span>
                Distance
              </span>

            </div>

            <div class="stat">

              <b>
                ${timeText}
              </b>

              <span>
                Estimated drive time
              </span>

            </div>

          </div>

          <div class="advice">

            <b>
              Route Advisory:
            </b>

            Check fuel,
            public transport,
            ATM and emergency
            services before travelling.

          </div>`;


        $("routeState")
          .textContent =
          "Ready";

      }

      catch (error) {

        $("routeInfo")
          .textContent =
          error.message;


        $("routeState")
          .textContent =
          "Error";

      }

    };

}


/* =========================================================
   NEARBY
========================================================= */

const nearbyTypes = {

  metro:
    [

      "🚇",
      "Metro",
      `["railway"="station"]["station"="subway"]`

    ],

  bus:
    [

      "🚌",
      "Bus",
      `["highway"="bus_stop"]`

    ],

  fuel:
    [

      "⛽",
      "Fuel",
      `["amenity"="fuel"]`

    ],

  atm:
    [

      "🏧",
      "ATM",
      `["amenity"="atm"]`

    ]

};


function calculateDistance(
  a,
  b
) {

  const R =
    6371;


  const dLat =
    (b.lat - a.lat) *
    Math.PI /
    180;


  const dLon =
    (b.lon - a.lon) *
    Math.PI /
    180;


  const x =
    Math.sin(
      dLat / 2
    ) ** 2 +

    Math.cos(
      a.lat *
      Math.PI /
      180
    ) *

    Math.cos(
      b.lat *
      Math.PI /
      180
    ) *

    Math.sin(
      dLon / 2
    ) ** 2;


  return (
    2 *
    R *
    Math.asin(
      Math.sqrt(x)
    )
  );

}


async function findNearby(
  type
) {

  if (!myPosition) {

    locate();

    return;

  }


  const [
    icon,
    name,
    filter
  ] =
    nearbyTypes[type];


  $("nearbyResults")
    .textContent =
    "Searching...";


  const query =
    `[out:json][timeout:15];

    (
      node(
        around:3000,
        ${myPosition.lat},
        ${myPosition.lon}
      )
      ${filter};

      way(
        around:3000,
        ${myPosition.lat},
        ${myPosition.lon}
      )
      ${filter};
    );

    out center tags;`;


  try {

    const response =
      await fetch(
        "https://overpass-api.de/api/interpreter",
        {

          method:
            "POST",

          body:
            query

        }
      );


    const data =
      await response.json();


    nearbyLayer
      .clearLayers();


    const places =
      data.elements
        .map(
          element => {

            const lat =
              element.lat ||
              element.center?.lat;


            const lon =
              element.lon ||
              element.center?.lon;


            const tags =
              element.tags ||
              {};


            return {

              lat,

              lon,

              name:
                tags.name ||
                tags.brand ||
                name,

              distance:
                calculateDistance(
                  myPosition,
                  {
                    lat,
                    lon
                  }
                )

            };

          }
        )
        .filter(
          place =>
            Number.isFinite(
              place.lat
            ) &&
            Number.isFinite(
              place.lon
            )
        )
        .sort(
          (a, b) =>
            a.distance -
            b.distance
        )
        .slice(
          0,
          10
        );


    if (!places.length) {

      $("nearbyResults")
        .textContent =
        "No nearby results found.";

      return;

    }


    $("nearbyResults")
      .innerHTML =
      places
        .map(
          (place, index) =>

            `<div class="place">

              <div>

                <b>
                  ${icon}
                  ${place.name}
                </b>

                <small>

                  ${
                    place.distance < 1

                      ? Math.round(
                          place.distance *
                          1000
                        ) +
                        " m"

                      : place.distance
                          .toFixed(1) +
                        " km"

                  }

                </small>

              </div>

              <button
                data-index="${index}"
              >
                Show
              </button>

            </div>`

        )
        .join("");


    places.forEach(
      place => {

        nearbyLayer.addLayer(

          L.marker([
            place.lat,
            place.lon
          ])
            .bindPopup(
              place.name
            )

        );

      }
    );


    $("nearbyResults")
      .querySelectorAll(
        "button"
      )
      .forEach(
        button => {

          button.onclick =
            () => {

              const place =
                places[
                  Number(
                    button.dataset.index
                  )
                ];


              map.setView(
                [
                  place.lat,
                  place.lon
                ],
                17
              );

            };

        }
      );

  }

  catch (error) {

    console.error(
      "NEARBY ERROR:",
      error
    );


    $("nearbyResults")
      .textContent =
      "Nearby search failed.";

  }

}


document
  .querySelectorAll(
    ".nearby button"
  )
  .forEach(
    button => {

      button.onclick =
        () => {

          document
            .querySelectorAll(
              ".nearby button"
            )
            .forEach(
              b =>
                b.classList
                  .remove(
                    "active"
                  )
            );


          button
            .classList
            .add(
              "active"
            );


          findNearby(
            button.dataset.kind
          );

        };

    }
  );


if ($("refresh")) {

  $("refresh").onclick =
    () => {

      const active =
        document.querySelector(
          ".nearby button.active"
        );


      if (active) {

        findNearby(
          active.dataset.kind
        );

      }

    };

}


/* =========================================================
   START APPLICATION
========================================================= */

locate();

registerSafeId();
