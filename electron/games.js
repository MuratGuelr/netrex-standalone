module.exports = {
  // Popüler oyunların process isimleri, görünen isimleri ve logo URL'leri
  // Logo kaynakları: Steam CDN ve resmi kaynaklardan kalıcı linkler
  GAME_PROCESSES: {
    // FPS / Shooter
    "VALORANT-Win64-Shipping.exe": { 
      name: "VALORANT", 
      icon: "🎯", 
      iconUrl: "https://i.imgur.com/VIeeGBI.png" 
    },
    "VALORANT.exe": { 
      name: "VALORANT", 
      icon: "🎯", 
      iconUrl: "https://i.imgur.com/VIeeGBI.png" 
    },
    "csgo.exe": { 
      name: "CS:GO", 
      icon: "🔫", 
      iconUrl: "https://cdn2.steamgriddb.com/icon/01063bcf7624297fbb408495bcb62904/8/128x128.png" 
    },
    "cs2.exe": { 
      name: "Counter-Strike 2", 
      icon: "🔫", 
      iconUrl: "https://cdn2.steamgriddb.com/icon/01063bcf7624297fbb408495bcb62904/8/128x128.png" 
    },
    "RainbowSix.exe": { 
      name: "Rainbow Six Siege", 
      icon: "🛡️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/359550/d6b3eebf975959c0682a8c4d07ab298dfee32e2a.jpg" 
    },
    "r5apex.exe": { 
      name: "Apex Legends", 
      icon: "🏆", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1172470/600f7bdd32dea090934faeb17ba02166b4e3b94f.jpg" 
    },
    "Overwatch.exe": { 
      name: "Overwatch 2", 
      icon: "🦸", 
      iconUrl: "https://i.imgur.com/eYuZKbi.png" 
    },
    "FortniteClient-Win64-Shipping.exe": { 
      name: "Fortnite", 
      icon: "🏗️", 
      iconUrl: "https://i.imgur.com/XgUJmGV.png" 
    },
    "PUBG.exe": { 
      name: "PUBG", 
      icon: "🪖", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/578080/b3a14ae3ea9aabd683b32089e232caa727b2d477.jpg" 
    },
    "TslGame.exe": { 
      name: "PUBG", 
      icon: "🪖", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/578080/b3a14ae3ea9aabd683b32089e232caa727b2d477.jpg" 
    },
    "cod.exe": { 
      name: "Call of Duty", 
      icon: "🎖️", 
      iconUrl: "https://i.imgur.com/4RXoHYk.png" 
    },
    "ModernWarfare.exe": { 
      name: "Call of Duty: MW", 
      icon: "🎖️", 
      iconUrl: "https://i.imgur.com/4RXoHYk.png" 
    },
    "BlackOpsColdWar.exe": { 
      name: "Call of Duty: Cold War", 
      icon: "🎖️", 
      iconUrl: "https://i.imgur.com/4RXoHYk.png" 
    },
    "Warzone.exe": { 
      name: "Call of Duty: Warzone", 
      icon: "🎖️", 
      iconUrl: "https://i.imgur.com/4RXoHYk.png" 
    },
    
    // MOBA / Strategy
    "League of Legends.exe": { 
      name: "League of Legends", 
      icon: "⚔️", 
      iconUrl: "https://i.imgur.com/CRbSF5S.png" 
    },
    "LeagueClient.exe": { 
      name: "League of Legends", 
      icon: "⚔️", 
      iconUrl: "https://i.imgur.com/CRbSF5S.png" 
    },
    "DOTA2.exe": { 
      name: "Dota 2", 
      icon: "🗡️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/570/0bbb630d63262dd66d2fdd0f7d37e8661a410075.jpg" 
    },
    "dota2.exe": { 
      name: "Dota 2", 
      icon: "🗡️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/570/0bbb630d63262dd66d2fdd0f7d37e8661a410075.jpg" 
    },
    "StarCraft II.exe": { 
      name: "StarCraft II", 
      icon: "🚀", 
      iconUrl: "https://i.imgur.com/kZphp4H.png" 
    },
    "SC2_x64.exe": { 
      name: "StarCraft II", 
      icon: "🚀", 
      iconUrl: "https://i.imgur.com/kZphp4H.png" 
    },
    
    // Battle Royale / Survival
    "RustClient.exe": { 
      name: "Rust", 
      icon: "🏚️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/252490/e538c0c3e44ff7b4df8516f2d4f989f2b21dfaaa.jpg" 
    },
    "EscapeFromTarkov.exe": { 
      name: "Escape from Tarkov", 
      icon: "💀", 
      iconUrl: "https://i.imgur.com/tARC9vR.png" 
    },
    "DayZ_x64.exe": { 
      name: "DayZ", 
      icon: "🧟", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/221100/cf0cd8ce44eb04e1c2ab66143e6f7b37a00429d5.jpg" 
    },
    "SCUM.exe": { 
      name: "SCUM", 
      icon: "🔗", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/513710/c43e993a0f1d38cba41ac8bba5c4217ba46c1838.jpg" 
    },
    "TheForest.exe": { 
      name: "The Forest", 
      icon: "🌲", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/242760/0e74f4e7f32f98dfd5c97c1a23f65c78fe2f05e0.jpg" 
    },
    "SonsOfTheForest.exe": { 
      name: "Sons of the Forest", 
      icon: "🌲", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1326470/f37b87ca9e36cc14ce1d8f9a47e414f5c6c3cda7.jpg" 
    },
    
    // MMO / RPG
    "Genshin Impact.exe": { 
      name: "Genshin Impact", 
      icon: "⭐", 
      iconUrl: "https://i.imgur.com/jIXMXg9.png" 
    },
    "GenshinImpact.exe": { 
      name: "Genshin Impact", 
      icon: "⭐", 
      iconUrl: "https://i.imgur.com/jIXMXg9.png" 
    },
    "eldenring.exe": { 
      name: "Elden Ring", 
      icon: "🔥", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1245620/856646808d1ddd8a7eb6e00cb5b9fbf2cbca0c86.jpg" 
    },
    "DarkSoulsIII.exe": { 
      name: "Dark Souls III", 
      icon: "🌑", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/374320/6d7f143b2c1ad1eeea88e5ee19a76142e629161c.jpg" 
    },
    "Diablo IV.exe": { 
      name: "Diablo IV", 
      icon: "👹", 
      iconUrl: "https://i.imgur.com/h8xHAzF.png" 
    },
    "PathOfExile_x64.exe": { 
      name: "Path of Exile", 
      icon: "💎", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/238960/4f5cdcb0e5d0bc93f6cf628ae01b6c62a44f3219.jpg" 
    },
    "FFXIV_DX11.exe": { 
      name: "Final Fantasy XIV", 
      icon: "🎮", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/39210/f7c5cc0ebeb2c096f8db39d46cbbcf3d3308c867.jpg" 
    },
    "BlackDesert64.exe": { 
      name: "Black Desert Online", 
      icon: "🏜️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/582660/dd5877f8fbfad7e00f0ccf16dbce20c84bf6e85b.jpg" 
    },
    "WowClassic.exe": { 
      name: "WoW Classic", 
      icon: "🐉", 
      iconUrl: "https://i.imgur.com/qJyNPLU.png" 
    },
    "Wow.exe": { 
      name: "World of Warcraft", 
      icon: "🐉", 
      iconUrl: "https://i.imgur.com/qJyNPLU.png" 
    },
    "GuildWars2-64.exe": { 
      name: "Guild Wars 2", 
      icon: "⚔️", 
      iconUrl: "https://i.imgur.com/vdXhqRm.png" 
    },
    "NewWorld.exe": { 
      name: "New World", 
      icon: "🗺️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1063730/4b0a39594190f8bd5f34b579af8efbd84c803b86.jpg" 
    },
    "lostark.exe": { 
      name: "Lost Ark", 
      icon: "⚡", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1599340/bbaacc3d5f1c1fe903c1b74f52e46900b6b86ef4.jpg" 
    },
    
    // Sandbox / Simulation
    "Minecraft.exe": { 
      name: "Minecraft", 
      icon: "🟫", 
      iconUrl: "https://i.imgur.com/JJpgDdD.png" 
    },
    "javaw.exe": { 
      name: "Minecraft (Java)", 
      icon: "🟫", 
      iconUrl: "https://i.imgur.com/JJpgDdD.png" 
    },
    "Terraria.exe": { 
      name: "Terraria", 
      icon: "🌍", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/105600/ada0a226c88f8a2a2ad3c5d1cf5355e7d98f08ed.jpg" 
    },
    "Factorio.exe": { 
      name: "Factorio", 
      icon: "🏭", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/427520/bec01e01a8c3c0da4129e62ac5f1b4e11718cde7.jpg" 
    },
    "Satisfactory.exe": { 
      name: "Satisfactory", 
      icon: "🏗️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/526870/c272b35355f5d0aae0d1093daebc9d82e2670c71.jpg" 
    },
    "Valheim.exe": { 
      name: "Valheim", 
      icon: "⛏️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/892970/8ff56f0ec83a97839c18c95b6c7aa7bb18eb3e64.jpg" 
    },
    "7DaysToDie.exe": { 
      name: "7 Days to Die", 
      icon: "🧟", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/251570/8c87af3b1ebce3e02b1e93e3a9b01146c3ee6e70.jpg" 
    },
    "eurotrucks2.exe": { 
      name: "Euro Truck Simulator 2", 
      icon: "🚛", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/227300/f2e8bf6f63f810ea19db43077c9fa4e44691e93b.jpg" 
    },
    "amtrucks.exe": { 
      name: "American Truck Simulator", 
      icon: "🚛", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/270880/f5c70e4aeffd7d9bf23069043bb7927f9c54d626.jpg" 
    },
    "FlightSimulator.exe": { 
      name: "Microsoft Flight Simulator", 
      icon: "✈️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1250410/8d5cf0a79b6d58d66aef3b8d64b4a3eee5e1e48e.jpg" 
    },
    "Cities.exe": { 
      name: "Cities: Skylines", 
      icon: "🏙️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/255710/0afc6c673f5fc7a2e49dd485a2f1318dd803e52c.jpg" 
    },
    "RimWorldWin64.exe": { 
      name: "RimWorld", 
      icon: "🌌", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/294100/cd0dcbd2f68e40e90e0f5e0d5fdc3cc0e2a17a8e.jpg" 
    },
    
    // Racing
    "ForzaHorizon5.exe": { 
      name: "Forza Horizon 5", 
      icon: "🏎️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1551360/39abf47e2f8e81bb8c52f4e7f44f93f7ba1f4f21.jpg" 
    },
    "ForzaHorizon4.exe": { 
      name: "Forza Horizon 4", 
      icon: "🏎️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1293830/1e2a35fb64a03bde7f4e70b08b0dc1e9c9a1c5e6.jpg" 
    },
    "F1_2023.exe": { 
      name: "F1 2023", 
      icon: "🏁", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/2108330/f2ff7e41797f42bf838b69fab88bf9d8c0d78e38.jpg" 
    },
    "F1_2024.exe": { 
      name: "F1 2024", 
      icon: "🏁", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/2488620/b7d84d98a21caadc58e61e9f09f77ca1f1e26a91.jpg" 
    },
    "AssettoCorsa.exe": { 
      name: "Assetto Corsa", 
      icon: "🏎️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/244210/db8c3728e9fe58b63e734eefb6391a87da13e41d.jpg" 
    },
    "acc.exe": { 
      name: "Assetto Corsa Competizione", 
      icon: "🏎️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/805550/5ca1bdfc30a33b4ebc1b50cd0e94a51d3ea14ef0.jpg" 
    },
    "RL.exe": { 
      name: "Rocket League", 
      icon: "🚗", 
      iconUrl: "https://cdn2.steamgriddb.com/icon/f1e513f02d2dbe70b939178cb7d4fbac/32/128x128.png" 
    },
    "RocketLeague.exe": { 
      name: "Rocket League", 
      icon: "🚗", 
      iconUrl: "https://cdn2.steamgriddb.com/icon/f1e513f02d2dbe70b939178cb7d4fbac/32/128x128.png" 
    },
    "NFS21.exe": { 
      name: "Need for Speed", 
      icon: "🏎️", 
      iconUrl: "https://i.imgur.com/pf0YDUN.png" 
    },
    
    // Sports
    "FC24.exe": { 
      name: "EA FC 24", 
      icon: "⚽", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/2195250/eaee0b0e36005e76e6f97c41cc4dab6e39ee2e89.jpg" 
    },
    "FIFA23.exe": { 
      name: "FIFA 23", 
      icon: "⚽", 
      iconUrl: "https://i.imgur.com/wnUYwTN.png" 
    },
    "NBA2K24.exe": { 
      name: "NBA 2K24", 
      icon: "🏀", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/2338770/7b37fb5c5b2e9e8cc0d2e5f90b68f7e4d6ad3a94.jpg" 
    },
    
    // Horror
    "Phasmophobia.exe": { 
      name: "Phasmophobia", 
      icon: "👻", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/739630/9cd8dc70fa1edc43d7af61f57e63b5f8ef5f4fb3.jpg" 
    },
    "Dead by Daylight.exe": { 
      name: "Dead by Daylight", 
      icon: "🔪", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/381210/5f3a30dbe7fc16d97e1da4c34d47df8aa88536ef.jpg" 
    },
    "DeadByDaylight-Win64-Shipping.exe": { 
      name: "Dead by Daylight", 
      icon: "🔪", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/381210/5f3a30dbe7fc16d97e1da4c34d47df8aa88536ef.jpg" 
    },
    "RE4.exe": { 
      name: "Resident Evil 4", 
      icon: "🧟", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/2050650/3fbdec7e4c32cec20daf1fc18a92c91072ab0829.jpg" 
    },
    "re8.exe": { 
      name: "Resident Evil Village", 
      icon: "🧟", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1196590/b43b1057c93b4ace73a7b4da7d2edd22e08088b0.jpg" 
    },
    "Lethal Company.exe": { 
      name: "Lethal Company", 
      icon: "👽", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1966720/a5fcf6f9c1f95e6fe56e6637a5af3955e487e657.jpg" 
    },
    
    // Co-op / Multiplayer
    "left4dead2.exe": { 
      name: "Left 4 Dead 2", 
      icon: "🧟", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/550/205a6e01e6d5c325ce9f21bb29c4c5e6fe02934c.jpg" 
    },
    "Back4Blood.exe": { 
      name: "Back 4 Blood", 
      icon: "🧟", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/924970/07e42e2f70858aa82dca4c6d4cf1e6e20acd41f4.jpg" 
    },
    "Payday3Client-Win64-Shipping.exe": { 
      name: "Payday 3", 
      icon: "🏦", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1272080/bc73b46ee63af88b8c2f1b0ee7b40fc8e3cb15f0.jpg" 
    },
    "PAYDAY2.exe": { 
      name: "Payday 2", 
      icon: "🏦", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/218620/0ff0ea80f79ca24afab3a3700a01f8a59c4e16f0.jpg" 
    },
    "gtav.exe": { 
      name: "GTA V", 
      icon: "🌆", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/271590/467b0daa852fbe2f11ede7b9bcf007cf7a370cbd.jpg" 
    },
    "GTA5.exe": { 
      name: "GTA V", 
      icon: "🌆", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/271590/467b0daa852fbe2f11ede7b9bcf007cf7a370cbd.jpg" 
    },
    "RDR2.exe": { 
      name: "Red Dead Redemption 2", 
      icon: "🤠", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1174180/ba0c26d6fe5a25c91c22c85bc00fcc08a4b8d1be.jpg" 
    },
    "SeaOfThieves.exe": { 
      name: "Sea of Thieves", 
      icon: "🏴‍☠️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1172620/da01c8bb5726c03ea89c6c5d43b04ee47d84c42d.jpg" 
    },
    "DeepRockGalactic-Win64-Shipping.exe": { 
      name: "Deep Rock Galactic", 
      icon: "⛏️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/548430/bc87fa36c9dba4ddcc12c22f6e8598ae7bb7d60b.jpg" 
    },
    "Helldivers2.exe": { 
      name: "Helldivers 2", 
      icon: "🪖", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/553850/36f1ad9a4e17f3e5e5bd0a9c8dfa97b17da0d045.jpg" 
    },
    
    // VR
    "VRChat.exe": { 
      name: "VRChat", 
      icon: "🥽", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/438100/3ecc253f6dccdfa0f8a493c6fb3f6bf23ac46467.jpg" 
    },
    "BeatSaber.exe": { 
      name: "Beat Saber", 
      icon: "🎵", 
      iconUrl: "https://i.imgur.com/iGxLvjB.png" 
    },
    "Gorilla Tag.exe": { 
      name: "Gorilla Tag", 
      icon: "🦍", 
      iconUrl: "https://i.imgur.com/zxV4YVY.png" 
    },
    "Golf With Your Friends.exe": { name: "Golf With Your Friends", icon: "⛳", iconUrl: "https://cdn2.steamgriddb.com/icon/7dc3338d429a3114842ca29dbbfccfef/32/128x128.png" },
    
    // RTS / Turn-Based
    "Civ6.exe": { 
      name: "Civilization VI", 
      icon: "🏛️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/289070/18f6d4e3e9ee32b62b6fb74e80c9e0adc0d11164.jpg" 
    },
    "TotalWar.exe": { 
      name: "Total War", 
      icon: "⚔️", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/779340/c4c22205bb14f1e4b47e08e00db27c1e8be72fc8.jpg" 
    },
    "Warhammer3.exe": { 
      name: "Warhammer III", 
      icon: "🔨", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1142710/2ceb5df0fa89f0c9ae0feaa57edf39eb951c5ea0.jpg" 
    },
    "AoE2DE_s.exe": { 
      name: "Age of Empires II", 
      icon: "🏰", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/813780/c4e51e9f41a1ceef67bfabc6e8ad2c8de5b83e75.jpg" 
    },
    "AoE4.exe": { 
      name: "Age of Empires IV", 
      icon: "🏰", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1466860/e9ff28e68ac02a00bc8ba6bd1d3ca088c3ff67f4.jpg" 
    },
    
    // Card / Auto-battler
    "Hearthstone.exe": { 
      name: "Hearthstone", 
      icon: "🃏", 
      iconUrl: "https://i.imgur.com/jdHHLLy.png" 
    },
    
    // Indie / Popular
    "Palworld-Win64-Shipping.exe": { 
      name: "Palworld", 
      icon: "🐾", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1623730/b4ab16c7c807cf5c8d6d6e4bab0d4be03c3c3ab0.jpg" 
    },
    "Hades.exe": { 
      name: "Hades", 
      icon: "🔥", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1145360/7b2bbb87a8dd2a4c5c6e79dd6e2bd7fd63e7c0b4.jpg" 
    },
    "Hades2.exe": { 
      name: "Hades II", 
      icon: "🔥", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1145350/31634a0e4ea4b06aa68fd26d37ffc88b87a21e01.jpg" 
    },
    "HollowKnight.exe": { 
      name: "Hollow Knight", 
      icon: "🦋", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/367520/2e8e15cb8a7df1f6f5e1efed45c402e9b92edd92.jpg" 
    },
    "Celeste.exe": { 
      name: "Celeste", 
      icon: "🍓", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/504230/7a5d23c98cedc08c3367999757e5b89fcf25fc3a.jpg" 
    },
    "Stardew Valley.exe": { 
      name: "Stardew Valley", 
      icon: "🌾", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/413150/5cbf70fcc0e34f6396c9f2d0a7c7bcac91e0b1dc.jpg" 
    },
    "Cuphead.exe": { 
      name: "Cuphead", 
      icon: "🍵", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/268910/0c27b9296ca3b2de2a13d2b82e41a1b5b5e93b15.jpg" 
    },
    "AmongUs.exe": { 
      name: "Among Us", 
      icon: "🚀", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/945360/8c6c8ad05c14baa00193d4e474f8637cc671e66d.jpg" 
    },
    "Fall Guys.exe": { 
      name: "Fall Guys", 
      icon: "👑", 
      iconUrl: "https://i.imgur.com/w8b8pRT.png" 
    },
    "Baldur's Gate 3.exe": { 
      name: "Baldur's Gate 3", 
      icon: "🐲", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1086940/cf6fc8358e9f98b52ccf18cce6e4e6be1f87cda1.jpg" 
    },
    "bg3.exe": { 
      name: "Baldur's Gate 3", 
      icon: "🐲", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1086940/cf6fc8358e9f98b52ccf18cce6e4e6be1f87cda1.jpg" 
    },
    "bg3_dx11.exe": { 
      name: "Baldur's Gate 3", 
      icon: "🐲", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1086940/cf6fc8358e9f98b52ccf18cce6e4e6be1f87cda1.jpg" 
    },
    
    // Turkish Games
    "zula.exe": { 
      name: "Zula", 
      icon: "🔫", 
      iconUrl: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/477220/31ed46c5b8cff3ec5a5a9f76a6b8ad38a91fb1e5.jpg" 
    },
    "KnightOnline.exe": { 
      name: "Knight Online", 
      icon: "⚔️", 
      iconUrl: "https://i.imgur.com/dUPeS3j.png" 
    },
    "ko.exe": { 
      name: "Knight Online", 
      icon: "⚔️", 
      iconUrl: "https://i.imgur.com/dUPeS3j.png" 
    },
    "metin2client.exe": { 
      name: "Metin2", 
      icon: "🐉", 
      iconUrl: "https://i.imgur.com/nQcY4gM.png" 
    },
    "Metin2.exe": { 
      name: "Metin2", 
      icon: "🐉", 
      iconUrl: "https://i.imgur.com/nQcY4gM.png" 
    },
    "Wolfteam.exe": { 
      name: "Wolfteam", 
      icon: "🐺", 
      iconUrl: "https://i.imgur.com/FjNs3Ld.png" 
    },
    "PointBlank.exe": { 
      name: "Point Blank", 
      icon: "🎯", 
      iconUrl: "https://i.imgur.com/8kZLp9J.png" 
    },
    "aces.exe": { name: "War Thunder", icon: "🎖️", iconUrl: "https://cdn2.steamgriddb.com/icon/a8f9c922be3d2559a3b6da1429bc1301/32/128x128.png" },
    "bf1.exe": { name: "Battlefield 1", icon: "🪖", iconUrl: "https://cdn2.steamgriddb.com/icon/306ab9fb2df792a2c777bef9d0a0f2b1/32/128x128.png" },

    // Sifu
    "Sifu-Win64-Shipping.exe": { name: "Sifu", icon: "👊", iconUrl: "https://cdn2.steamgriddb.com/icon/827cf4bc2f28f73e24c151cad3be7567/32/128x128.png" },
    "Sifu.exe": { name: "Sifu", icon: "👊", iconUrl: "https://cdn2.steamgriddb.com/icon/827cf4bc2f28f73e24c151cad3be7567/32/128x128.png" },

    // Max Payne 2
    "maxpayne2.exe": { name: "Max Payne 2", icon: "🕵️‍♂️", iconUrl: "https://cdn2.steamgriddb.com/icon/e465ae46b07058f4ab5e96b98f101756/32/256x256.png" },
    "MaxPayne2.exe": { name: "Max Payne 2", icon: "🕵️‍♂️", iconUrl: "https://cdn2.steamgriddb.com/icon/e465ae46b07058f4ab5e96b98f101756/32/256x256.png" },

    // Kingdom Come: Deliverance 1
    "KingdomCome.exe": { 
      name: "Kingdom Come: Deliverance", 
      icon: "⚔️", 
      iconUrl: "https://cdn2.steamgriddb.com/icon/b0fae80dbb4cabab2a00827fd7389f21/32/128x128.png" 
    },
    
    // Kingdom Come: Deliverance 2
    "KingdomCome2.exe": { 
      name: "Kingdom Come: Deliverance II", 
      icon: "🏰", 
      iconUrl: "https://cdn2.steamgriddb.com/icon/87d655b334d24764e1dd1b377f505922/32/128x128.png" 
    },
    "KCD2.exe": { // Alternatif exe ismi ihtimaline karşı
      name: "Kingdom Come: Deliverance II", 
      icon: "🏰", 
      iconUrl: "https://cdn2.steamgriddb.com/icon/87d655b334d24764e1dd1b377f505922/32/128x128.png" 
    },
  }
};