import { Client, Events, GatewayIntentBits, ActivityType, Partials, TextBasedChannel, EmbedBuilder,  } from "discord.js";
import dotenv from "dotenv"
import { queryGameServerInfo } from "steam-server-query"
import fs from "fs"

const jsonConfig = JSON.parse(fs.readFileSync( './config.json', 'utf8' ));

const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [
        Partials.Message,
        Partials.Reaction
    ]
});

const getServerPlayerCount = async ( serverIp: string ) => {
    
    const result = await queryGameServerInfo(serverIp, 5, 5000 )
    
    return {
        playerCount: result.players,
        maxPlayerCount: result.maxPlayers
    }
}

const setBotName = async ( name: string, serverInfo: { playerCount: number, maxPlayerCount: number } ) => {
    const guild = discordClient.guilds.cache.get( jsonConfig?.discordGuildId || '' );

    if ( guild?.members.me?.nickname !== name ) {
        console.log(`Setting bot name to ${name}`)
        await guild?.members.me?.setNickname( name );
    }

    console.log(`bot name is ${guild?.members.me?.nickname}`)

    discordClient.user?.setPresence( {
        activities: [
            {
                name: `${serverInfo.playerCount}/${serverInfo.maxPlayerCount}`,
                type: ActivityType.Playing
            }
        ]
    })
}

const onUpdate = async () => {

    console.log(`Updating...`)

    const playerCountInfo = await getServerPlayerCount( jsonConfig.gameServerIp || '' );
    const serverName = jsonConfig.serverName || '';

    console.log(`Player count: ${playerCountInfo.playerCount}/${playerCountInfo.maxPlayerCount} on ${serverName}`)

    setBotName( serverName, playerCountInfo );

}

const writeToJson = ( json: any ) => {
    fs.writeFileSync( './config.json', JSON.stringify( json, null, 4 ) );
}

discordClient.once(Events.ClientReady, async (client) => {

    const myGuild = await client.guilds.fetch( jsonConfig.discordGuildId );

    let verificationChannel = client.channels.cache.get( jsonConfig.verificationChannelId ) as TextBasedChannel;

    if ( !verificationChannel ) {
        verificationChannel = await myGuild.channels.create( { name: `verifcation` } );
        jsonConfig.verificationChannelId = verificationChannel.id;
        writeToJson( jsonConfig );
    }

    
    let verificationMessage;

    const verificaitonEmbed = new EmbedBuilder()
        .setTitle( `Verification` )
        .setDescription( `React with ${jsonConfig.verificationEmoji} to get access to the server` )
        .setColor( 0xfc033d );

    try {
        verificationMessage = await verificationChannel.messages.fetch( jsonConfig.verificationMessageId );
        verificationMessage.edit( {
            embeds: [ verificaitonEmbed ]
        })
    } catch ( error ) {
        console.log(`Error fetching message: ${error}`)
    }

    if ( !verificationMessage ) {

            
        verificationMessage = await verificationChannel.send( {
            embeds: [ verificaitonEmbed ]
        })
        jsonConfig.verificationMessageId = verificationMessage.id;
        writeToJson( jsonConfig );
    }


    verificationMessage.react( jsonConfig.verificationEmoji );





    setInterval( onUpdate, 5000 );
});

discordClient.on( Events.MessageReactionAdd, async ( reaction, user ) => {

    console.log(`Reaction ${reaction.emoji.name} added by ${user.username}`)

    if ( reaction.message.id != jsonConfig.verificationMessageId ) return;

    if (reaction.emoji.name !== jsonConfig.verificationEmoji ) return;

    const guild = reaction.message.guild;
    const role = guild?.roles.cache.find(r => r.id === jsonConfig.verificationRoleId );

    if ( !role ) return;

    const member = guild?.members.cache.find( m => m.id === user.id );
    if ( !member ) return;


    await member.roles.add( role );

    console.log(`Added role ${role.name} to ${member.user.username}`)
    //reaction.users.remove( user.id );

})

discordClient.login( jsonConfig.discordToken )