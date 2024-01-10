import { Client, Events, GatewayIntentBits, ActivityType, Partials,  } from "discord.js";
import dotenv from "dotenv"
import { queryGameServerInfo } from "steam-server-query"

dotenv.config()

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
    const guild = discordClient.guilds.cache.get( process.env.DISCORD_GUILD_ID || '' );

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


    const playerCountInfo = await getServerPlayerCount( process.env.GAMESERVER_IP || '' );
    const serverName = process.env.SERVER_NAME || '';

    console.log(`Player count: ${playerCountInfo.playerCount}/${playerCountInfo.maxPlayerCount} on ${serverName}`)

    setBotName( serverName, playerCountInfo );

}

discordClient.once(Events.ClientReady, (client) => {


    setInterval( onUpdate, 5000 );
});

discordClient.on( Events.MessageReactionAdd, async ( reaction, user ) => {

    console.log(`Reaction ${reaction.emoji.name} added by ${user.username}`)

    if ( reaction.message.id != process.env.VERIFICATION_MESSAGE_ID ) return;

    if (reaction.emoji.name !== process.env.VERIFICATION_EMOJI) return;

    const guild = reaction.message.guild;
    const role = guild?.roles.cache.find(r => r.id === process.env.VERIFICATION_ROLE_ID);

    if ( !role ) return;

    const member = guild?.members.cache.find( m => m.id === user.id );
    if ( !member ) return;


    await member.roles.add( role );

    console.log(`Added role ${role.name} to ${member.user.username}`)
    //reaction.users.remove( user.id );

})

discordClient.login( process.env.DISCORD_TOKEN )