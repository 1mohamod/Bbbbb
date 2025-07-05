require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, SlashCommandBuilder, REST, Routes, InteractionType, ChannelType } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    partials: [Partials.Channel]
});

const blockedUsers = new Set();
const applicationsChannel = new Map();

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // تسجيل الأوامر تلقائيًا
    const commands = [
        new SlashCommandBuilder()
            .setName('setup')
            .setDescription('إرسال زر التقديم')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('الروم اللي ترسل فيه التقديمات')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('block')
            .setDescription('حظر عضو من التقديم')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('المستخدم اللي تبغى تحظره')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('unblock')
            .setDescription('فك الحظر عن عضو')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('المستخدم اللي تبغى تفك الحظر عنه')
                    .setRequired(true)
            )
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(process.env.BOT_ID),
            { body: commands }
        );
        console.log('✅ تم تسجيل أوامر الـ Slash');
    } catch (err) {
        console.error('❌ فشل تسجيل الأوامر:', err);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'setup') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ هذا الأمر للإدارة فقط.', ephemeral: true });
            }

            const channel = interaction.options.getChannel('channel');
            applicationsChannel.set(interaction.guild.id, channel.id);

            const button = new ButtonBuilder()
                .setCustomId('apply_button')
                .setLabel('📨 تقديم للإدارة')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(button);

            await channel.send({
                content: '**اضغط على الزر لتقديم طلب للإدارة**',
                components: [row]
            });

            await interaction.reply({ content: '✅ تم إرسال الزر بنجاح!', ephemeral: true });

        } else if (commandName === 'block') {
            const user = interaction.options.getUser('user');
            blockedUsers.add(user.id);
            await interaction.reply({ content: `✅ تم حظر <@${user.id}> من التقديم.`, ephemeral: true });

        } else if (commandName === 'unblock') {
            const user = interaction.options.getUser('user');
            blockedUsers.delete(user.id);
            await interaction.reply({ content: `✅ تم فك الحظر عن <@${user.id}>.`, ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'apply_button') {
            if (blockedUsers.has(interaction.user.id)) {
                return interaction.reply({ content: '❌ أنت محظور من التقديم.', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId('application_modal')
                .setTitle('نموذج تقديم الإدارة');

            const nameInput = new TextInputBuilder()
                .setCustomId('name')
                .setLabel('اسمك')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const ageInput = new TextInputBuilder()
                .setCustomId('age')
                .setLabel('عمرك')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const expInput = new TextInputBuilder()
                .setCustomId('experience')
                .setLabel('خبراتك')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const valueInput = new TextInputBuilder()
                .setCustomId('value')
                .setLabel('وش بتفيد السيرفر؟')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const modalRow1 = new ActionRowBuilder().addComponents(nameInput);
            const modalRow2 = new ActionRowBuilder().addComponents(ageInput);
            const modalRow3 = new ActionRowBuilder().addComponents(expInput);
            const modalRow4 = new ActionRowBuilder().addComponents(valueInput);

            modal.addComponents(modalRow1, modalRow2, modalRow3, modalRow4);
            await interaction.showModal(modal);
        }
    }

    if (interaction.type === InteractionType.ModalSubmit) {
        if (interaction.customId === 'application_modal') {
            const name = interaction.fields.getTextInputValue('name');
            const age = interaction.fields.getTextInputValue('age');
            const exp = interaction.fields.getTextInputValue('experience');
            const value = interaction.fields.getTextInputValue('value');

            const embed = new EmbedBuilder()
                .setTitle('📩 طلب تقديم جديد')
                .addFields(
                    { name: '👤 الاسم', value: name, inline: true },
                    { name: '🎂 العمر', value: age, inline: true },
                    { name: '📚 الخبرات', value: exp },
                    { name: '💡 الفائدة للسيرفر', value: value }
                )
                .setColor('#2ecc71')
                .setTimestamp()
                .setFooter({ text: `مقدم الطلب: ${interaction.user.tag}` });

            const sendChannelId = applicationsChannel.get(interaction.guild.id);
            if (!sendChannelId) {
                return interaction.reply({ content: '❌ لم يتم إعداد روم التقديمات بعد.', ephemeral: true });
            }

            const sendChannel = interaction.guild.channels.cache.get(sendChannelId);
            if (!sendChannel) {
                return interaction.reply({ content: '❌ الروم المحدد غير موجود.', ephemeral: true });
            }

            await sendChannel.send({ embeds: [embed] });
            await interaction.reply({ content: '✅ تم إرسال طلبك بنجاح!', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);