// O'zbekiston hududlari va ularning yirik shahar/tuman markazlari.
// Marketing saytidagi "Viloyat" -> "Shahar" bog'liq dropdownlari uchun
// yagona manba: sayt bu ro'yxatni GET /api/public/regions orqali oladi,
// shu bilan ikki joyda ikki xil ro'yxat bo'lib qolmaydi.
//
// MVP uchun har bir viloyatdan markaz + 5-10 ta yirik tuman markazi olingan
// (to'liq 200+ tumanlar ro'yxati keyingi bosqichda kengaytiriladi).

const REGIONS = [
  {
    name: 'Toshkent shahri',
    cities: [
      'Yunusobod', 'Mirzo Ulug\'bek', 'Chilonzor', 'Yakkasaroy', 'Shayxontohur',
      'Olmazor', 'Uchtepa', 'Sergeli', 'Yashnobod', 'Bektemir', 'Mirobod',
    ],
  },
  {
    name: 'Toshkent viloyati',
    cities: [
      'Nurafshon', 'Olmaliq', 'Angren', 'Chirchiq', 'Bekobod', 'Yangiyo\'l',
      'Ohangaron', 'Parkent', 'Piskent', 'Zangiota', 'Qibray',
    ],
  },
  {
    name: 'Andijon viloyati',
    cities: [
      'Andijon', 'Asaka', 'Xonobod', 'Shahrixon', 'Marhamat', 'Paytug\'',
      'Qo\'rg\'ontepa', 'Baliqchi', 'Izboskan',
    ],
  },
  {
    name: 'Farg\'ona viloyati',
    cities: [
      'Farg\'ona', 'Qo\'qon', 'Marg\'ilon', 'Quvasoy', 'Rishton', 'Beshariq',
      'Oltiariq', 'Bag\'dod', 'Yaypan',
    ],
  },
  {
    name: 'Namangan viloyati',
    cities: [
      'Namangan', 'Chust', 'Pop', 'Kosonsoy', 'To\'raqo\'rg\'on', 'Uchqo\'rg\'on',
      'Chortoq', 'Norin', 'Yangiqo\'rg\'on',
    ],
  },
  {
    name: 'Sirdaryo viloyati',
    cities: ['Guliston', 'Yangiyer', 'Shirin', 'Sirdaryo', 'Boyovut', 'Sardoba', 'Xovos'],
  },
  {
    name: 'Jizzax viloyati',
    cities: ['Jizzax', 'G\'allaorol', 'Do\'stlik', 'Zomin', 'Paxtakor', 'Forish', 'Baxmal'],
  },
  {
    name: 'Samarqand viloyati',
    cities: [
      'Samarqand', 'Kattaqo\'rg\'on', 'Urgut', 'Bulung\'ur', 'Jomboy', 'Ishtixon',
      'Payariq', 'Oqdaryo', 'Nurobod',
    ],
  },
  {
    name: 'Buxoro viloyati',
    cities: ['Buxoro', 'Kogon', 'G\'ijduvon', 'Vobkent', 'Romitan', 'Olot', 'Qorako\'l', 'Shofirkon'],
  },
  {
    name: 'Navoiy viloyati',
    cities: ['Navoiy', 'Zarafshon', 'Uchquduq', 'Karmana', 'Nurota', 'Konimex', 'Xatirchi'],
  },
  {
    name: 'Qashqadaryo viloyati',
    cities: ['Qarshi', 'Shahrisabz', 'Kitob', 'G\'uzor', 'Kasbi', 'Muborak', 'Koson', 'Yakkabog\''],
  },
  {
    name: 'Surxondaryo viloyati',
    cities: ['Termiz', 'Denov', 'Sherobod', 'Boysun', 'Sho\'rchi', 'Jarqo\'rg\'on', 'Qumqo\'rg\'on'],
  },
  {
    name: 'Xorazm viloyati',
    cities: ['Urganch', 'Xiva', 'Xonqa', 'Shovot', 'Gurlan', 'Bog\'ot', 'Yangibozor', 'Hazorasp'],
  },
  {
    name: 'Qoraqalpog\'iston Respublikasi',
    cities: ['Nukus', 'Xo\'jayli', 'Beruniy', 'Taxiatosh', 'Chimboy', 'Qo\'ng\'irot', 'Mo\'ynoq', 'To\'rtko\'l'],
  },
];

module.exports = { REGIONS };
