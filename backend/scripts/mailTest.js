// EMAIL YUBORISHNI SINASH — haqiqiy pochta serversiz.
//
// Skript o'zi kichik SMTP serverini ko'taradi (127.0.0.1:2525) va xatni
// aynan shunga yuboradi. Ya'ni sinov soxta emas: nodemailer haqiqiy
// ulanadi, autentifikatsiyadan o'tadi va xat matni to'liq qabul qilinadi —
// biz uni o'qib, ichida nima borligini tekshiramiz.
//
//   node scripts/mailTest.js
//
// Serverning o'zi kerak emas.

require('dotenv').config();
const { SMTPServer } = require('smtp-server');

const PORT = 2525;

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? '  ✔' : '  ✘'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures += 1;
};

// Qabul qilingan xatlar shu yerga tushadi
const inbox = [];

function startServer() {
  return new Promise((resolve, reject) => {
    const server = new SMTPServer({
      authOptional: false,
      // smtp-server'ning o'rnatilgan sinov sertifikati eskirgan va u
      // butun sinovni yiqitardi. Bu yerda shifrlash umuman kerak emas:
      // ulanish 127.0.0.1 ichida, kompyuterdan chiqmaydi.
      hideSTARTTLS: true,
      // Bu qatorsiz nodemailer plain-auth'ni shifrsiz kanalda yubormaydi
      authMethods: ['PLAIN', 'LOGIN'],
      // Sinov serveri: har qanday parolni qabul qiladi
      onAuth(auth, session, cb) {
        cb(null, { user: auth.username });
      },
      onData(stream, session, cb) {
        let raw = '';
        stream.on('data', (chunk) => {
          raw += chunk.toString('utf8');
        });
        stream.on('end', () => {
          inbox.push({ raw, to: session.envelope.rcptTo.map((r) => r.address) });
          cb();
        });
      },
    });
    server.on('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

// Xat gavdasi quoted-printable bo'lishi mumkin — tekshirish uchun ochamiz
function decode(raw) {
  return raw
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

async function main() {
  console.log('\n=== Email sinovi ===\n');

  // ---------- 1) Sozlanmagan holat ----------
  //
  // Eng muhim xulq: SMTP yo'q bo'lsa ham HECH NARSA yiqilmasligi kerak.
  console.log('1) SMTP sozlanmagan');
  {
    for (const k of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) delete process.env[k];
    // Modul birinchi marta shu yerda yuklanadi
    delete require.cache[require.resolve('../src/services/mailer')];
    const mailer = require('../src/services/mailer');

    check('sozlanmagani aniqlandi', mailer.isConfigured() === false);

    const res = await mailer.send({ to: 'kimdir@example.com', subject: 'x', text: 'y' });
    check('xato TASHLAMADI', res && res.sent === false, res && res.reason);
    check('sababi tushunarli', res.reason === 'SMTP_NOT_CONFIGURED', res.reason);
  }

  // ---------- 2) Shablon ----------
  console.log('\n2) Xat shabloni');
  {
    delete require.cache[require.resolve('../src/services/mailer')];
    const mailer = require('../src/services/mailer');
    const mail = mailer.welcomeEmail({
      placeName: 'Delish & Co',
      loginUrl: 'https://bazm.uz',
      phone: '+998901234567',
      password: 'bazm123456',
    });

    check('sarlavhada muassasa nomi bor', mail.subject.includes('Delish & Co'), mail.subject);
    for (const part of ['+998901234567', 'bazm123456', 'https://bazm.uz']) {
      check(`matnda ${part} bor`, mail.text.includes(part));
      check(`html'da ${part} bor`, mail.html.includes(part));
    }
    check('parolni almashtirish so\'ralgan', mail.text.includes('almashtiring'));
    check(
      'html\'da & belgisi qochirilgan (html buzilmasin)',
      mail.html.includes('Delish &amp; Co') && !mail.html.includes('Delish & Co')
    );
  }

  // ---------- 3) Haqiqiy yuborish ----------
  console.log('\n3) Haqiqiy SMTP orqali yuborish');
  const server = await startServer();
  try {
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = String(PORT);
    process.env.SMTP_USER = 'sinov@bazm.uz';
    process.env.SMTP_PASS = 'sinov-parol';
    process.env.MAIL_FROM = 'Bazm <no-reply@bazm.uz>';

    delete require.cache[require.resolve('../src/services/mailer')];
    const mailer = require('../src/services/mailer');
    check('sozlangani aniqlandi', mailer.isConfigured() === true);

    const mail = mailer.welcomeEmail({
      placeName: 'Sinov Kafe',
      loginUrl: 'http://localhost:5173',
      phone: '+998901112233',
      password: 'sirli-parol-777',
    });
    const res = await mailer.send({ to: 'egasi@example.com', ...mail });

    check('yuborildi', res.sent === true, res.reason || '');
    check('server bitta xat oldi', inbox.length === 1, `${inbox.length} ta`);

    if (inbox.length > 0) {
      const got = inbox[0];
      const body = decode(got.raw);
      check('qabul qiluvchi to\'g\'ri', got.to.includes('egasi@example.com'), got.to.join(', '));
      check('jo\'natuvchi ko\'rsatilgan', /no-reply@bazm\.uz/.test(body));
      check('parol xat ichida bor', body.includes('sirli-parol-777'));
      check('telefon xat ichida bor', body.includes('+998901112233'));
      check('muassasa nomi bor', body.includes('Sinov Kafe'));
      check('html qism ham bor', body.includes('<table') || body.includes('<div'));
    }

    // ---------- 4) Ariza -> tasdiqlash -> xat ----------
    //
    // Butun zanjir: saytdan kelgan ariza tasdiqlanadi, muassasa yaratiladi
    // va kirish ma'lumotlari arizadagi pochtaga O'ZI ketadi. Bu yerda
    // controller'ning o'zi chaqiriladi — ya'ni sinov "shunday bo'lsa kerak"
    // emas, haqiqiy yo'lni bosib o'tadi.
    console.log('\n4) Ariza tasdiqlangach xat o\'zi ketadi');
    {
      inbox.length = 0;
      const masterPrisma = require('../src/config/masterDb');
      const provisioning = require('../src/services/provisioning');
      delete require.cache[require.resolve('../src/modules/super-admin/superAdmin.controller')];
      const controller = require('../src/modules/super-admin/superAdmin.controller');

      const mark = `zz-pochta-${Date.now().toString(36)}`;
      const application = await masterPrisma.restaurantApplication.create({
        data: {
          name: 'Pochta Sinov Kafe',
          businessType: 'cafe',
          phone: `+99893${String(Date.now()).slice(-7)}`,
          email: 'egasi@example.com',
          region: 'Toshkent shahri',
          city: 'Yunusobod',
          plan: 'basic',
        },
      });

      let payload = null;
      let status = 0;
      const res = {
        status(code) {
          status = code;
          return this;
        },
        json(body) {
          payload = body;
          return this;
        },
      };

      await controller.approveApplication(
        { params: { id: application.id }, body: { slug: mark } },
        res,
        (err) => {
          throw err;
        }
      );

      check('ariza tasdiqlandi', status === 201, `HTTP ${status}`);
      check('muassasa yaratildi', !!(payload && payload.restaurant), payload && payload.restaurant && payload.restaurant.name);
      check('javobda xat holati bor', !!(payload && payload.email));
      check('xat yuborilgani aytildi', payload.email.sent === true, payload.email.reason || '');
      check('xat manzili to\'g\'ri', payload.email.to === 'egasi@example.com', payload.email.to);

      check('pochta serveri xatni oldi', inbox.length === 1, `${inbox.length} ta`);
      if (inbox.length > 0) {
        const body = decode(inbox[0].raw);
        check('xatda muassasa nomi bor', body.includes('Pochta Sinov Kafe'));
        check(
          'xatda AYNAN shu parol bor',
          !!(payload.adminCredentials && body.includes(payload.adminCredentials.password))
        );
        check('xatda telefon bor', body.includes(payload.adminCredentials.phone));
      }

      // Tozalash — sinov ortidan haqiqiy bazada hech narsa qolmasin
      await provisioning.deleteRestaurant(payload.restaurant.id);
      await masterPrisma.restaurantApplication.delete({ where: { id: application.id } });
      const left = await masterPrisma.restaurant.count({ where: { slug: mark } });
      check('sinov muassasasi o\'chirildi', left === 0);
    }

    // ---------- 5) Server yiqilsa ----------
    //
    // Pochta serveri o'chgani uchun chaqiruvchi kod yiqilmasligi kerak.
    console.log('\n5) Pochta serveri javob bermasa');
    await new Promise((r) => server.close(r));
    const failed = await mailer.send({ to: 'egasi@example.com', subject: 'x', text: 'y' });
    check('xato TASHLAMADI', failed && failed.sent === false);
    check('sababi qaytdi', !!failed.reason, failed.reason);
  } finally {
    try {
      server.close();
    } catch (_) {
      /* allaqachon yopilgan */
    }
  }

  console.log(`\n=== Natija: ${failures === 0 ? 'HAMMASI O\'TDI ✔' : `${failures} ta xato ✘`} ===\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n❌ Sinov to\'xtadi:', err);
  process.exit(1);
});
