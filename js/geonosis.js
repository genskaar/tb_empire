/* Custom directive for detecting click outside of element */
/*Vue.directive('click-outside', {
	bind: function (el, binding, vnode) {
		this.event = function (event) {
		if (!(el == event.target || el.contains(event.target))) {
			vnode.context[binding.expression](event);
		}
	};
	document.body.addEventListener('click', this.event)
	},
	unbind: function (el) {
		document.body.removeEventListener('click', this.event)
	},
});
	*/
Vue.component('mission', {
	data: function () {
		return {
		isMobile: false,
		squads: [
		//---------------------------------------------------------------------------------------------------------------------------------DS SQUADS
			{	
				id: 0,
				name: 'Sith Empire',
				toons: ['darth_revan', 'bastila_shan_(fallen)', 'hk-47', 'sith_marauder', 'darth_malak']
			},
			{
				id: 1,
				name: 'First Order',
				toons: ['kylo_ren_(unmasked)', 'kylo_ren', 'first_order_executioner', 'first_order_officer', 'first_order_stormtrooper'],
			},
			{
				id: 2,
				name: 'Bounty Hunters',
				toons: ['bossk','jango_fett', 'boba_fett', 'dengar', 'cad_bane']
			},
			{
				id: 3,
				name: 'Empire',
				toons: ['emperor_palpatine', 'darth_vader', 'grand_admiral_thrawn', 'grand_moff_tarkin', 'tie_fighter_pilot'  ]
			},
			{
				id: 4,
				name: 'Night Sisters',
				toons: ['mother_talzin', 'asajj_ventress', 'nightsister_zombie', 'old_daka', 'nightsister_spirit' ]
			},
			{
				id: 5,
				name: 'Sith Triumvirate',
				toons: ['darth_traya', 'darth_sion', 'darth_nihilus', 'sith_empire_trooper', 'count_dooku']
			},
			{
				id: 6,
				name: 'Separatist Droids',
				toons: ['general_grievous', 'b2_super_battle_droid', 'b1_battle_droid', 'droideka', 'ig100_magnaguard']
			},
			{
				id: 7,
				name: 'Geonosians',
				toons: ['geonosian_brood_alpha', 'geonosian_soldier', 'geonosian_spy', 'poggle_the_lesser', 'sun_fac'],
                video: "https://youtu.be/w754OsqH5vs?t=40&si=WBiXgwQf5Cm0wurB",
                videosource: "bd"
			},
			{
				id: 8,
				name: 'Nute team',
				toons: ['nute_gunrey', 'b1_battle_droid', 'b2_super_battle_droid', 'droideka', 'ig100_magnaguard' ]
			},
			{
				id: 9,
				name: 'Dooku + Asajj',
				toons: ['count_dooku', 'asajj_ventress']
			},
			{
				id: 10,
				name: 'Poggle Geos',
				toons: ['poggle_the_lesser', 'geonosian_soldier', 'geonosian_spy', 'sun_fac', 'geonosian_brood_alpha']
			},
			{
				id: 11,
				name: 'Chimaera standard',
				toons: ['hound\'s_tooth', 'imperial_tie_fighter', 'tie_silencer', 'xanadu_blood', 'emperor\'s_shuttle']
			},
			{
				id: 12,
				name: 'Executrix standard',
				toons: ['sun_fac\'s_geonosian_starfighter', 'geonosian_spy_starfighter', 'geonosian_soldier\'s_starfighter', 'gauntlet_starfighter', 'slave_i' ]
			},
			{
				id: 13,
				name: 'Chimaera bugs (without Hound\'s Tooth)',
				toons: ['sun_fac\'s_geonosian_starfighter', 'geonosian_spy_starfighter', 'geonosian_soldier\'s_starfighter', 'gauntlet_starfighter', 'slave_i']
			},
			{
				id: 14,
				name: 'Nightsisters without Asajj',
				toons: ['mother_talzin',  'nightsister_zombie', 'old_daka', 'nightsister_spirit', 'talia' ]
			},
			{
				id: 15,
				name: 'Sith Triumvirate without Dooku',
				toons: ['darth_traya', 'darth_sion', 'darth_nihilus', 'sith_empire_trooper', 'sith_assassin']
			},
			{
				id: 16,
				name: 'Test squad',
				toons: ['count_dooku', 'general_grievous', 'b2_super_battle_droid', 'nute_gunrey', 'b1_battle_droid']
			},
			{
				id: 17,
				name: 'Executrix without Hound\'s Tooth',
				toons: ['b-28_extinction-class_bomber', 'emperor\'s_shuttle', 'sith_fighter', 'tie_advanced_x1', 'xanadu_blood']
			},
			{
				id: 18,
				name: 'Chimaera with Hound\'s Tooth and bugs',
				toons: ['hound\'s_tooth', 'geonosian_spy_starfighter', 'geonosian_soldier\'s_starfighter', 'sun_fac\'s_geonosian_starfighter', 'gauntlet_starfighter', 'slave_i']
			},
			
			//---------------------------------------------------------------------------------------------------------------------------------LS SQUADS
			{
				id: 19, 
				name: 'LS test squad',
				toons: ['ahsoka_tano_(fulcrum)','ahsoka_tano_(fulcrum)','ahsoka_tano_(fulcrum)','ahsoka_tano_(fulcrum)','ahsoka_tano_(fulcrum)',] //hands down best character
			},
			{
				id: 20, //Use once points are updated
				name: 'LS test squad',
				toons: ['ahsoka_tano','ahsoka_tano','ahsoka_tano','ahsoka_tano','ahsoka_tano',] 
			},
			{
				id: 21, 
				name: 'Required: GAS and Snips (21k+ Power)',
				toons: ['general_skywalker','ahsoka_tano','noone','noone','noone'] 
			},
			{
				id: 22, 
				name: 'Required: Kenobi and Clones (21k+ Power)',
				toons: ['general_kenobi','cc-2224__cody_', 'clone_sergeant_-_phase_i','noone','noone'] 
			},
			{
				id: 23,
				name: 'Shaak-ti and Clones (22k+ Power)',
				toons: ['shaak_ti', 'arc_trooper', 'ct-21-0408__echo_', 'ct-5555__fives_', 'ct-7567__rex_']
				
			},
			{
				id: 24,
				name: 'Unknown',
				toons: ['unknown', 'unknown','unknown','unknown','unknown',]
				
			},
			{
				id:25,
				name: 'Required: Galactic Republic Jedi (23k+ Power)',
				toons: ['ki-adi-mundi', 'shaak_ti', 'gl_kenobi', 'mace_windu', 'aayla_secura',]
             },			
             {
                id:26,
                name: 'Kenobi Negotiator Fleet w/o Y-Wing',
                toons: ['negotiator', 'anakin\'s_eta-2_starfighter','ahsoka_tano\'s_jedi_starfighter', 'umbaran_starfighter', 'plo_koon\'s_jedi_starfighter', 'clone_sergeant\'s_arc-170', 'rex\'s_arc-170', 'jedi_consular\'s_starfighter']
             },
             {
                id:27,
                name: 'Home One Fleet',
                toons: ['han\'s_millennium_falcon'],
             },
              {
                id:28,
                name: 'Padme Republic  (Required: Padme and Galactic Republic )',
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','c-3po', 'ahsoka_tano'],
             },
             {
				id:29,
				name: 'Jedi Training Rey',
				toons: ['rey_(jedi_training)', 'c-3po', 'r2-d2', 'finn', 'bb-8'],
				 
			 },
			 {
				id:30,
				name: 'JKR Jedi (Required: Jedi)',
				toons: ['jedi_knight_revan', 'bastila_shan', 'jolee_bindo', 'hermit_yoda', 'grand_master_yoda'],
				 
			 },
			 {
                id:31,
                name: 'Kenobi Negotiator Fleet w/ Y-Wing',
                toons: ['negotiator', 'anakin\'s_eta-2_starfighter','ahsoka_tano\'s_jedi_starfighter', 'umbaran_starfighter', 'plo_koon\'s_jedi_starfighter', 'clone_sergeant\'s_arc-170', 'rex\'s_arc-170', 'BTL-B_Y-wing_Starfighter']
             },
             {
                id:32,
                name: 'Kenobi Negotiator Fleet - CS start (see video)',
                toons: ['negotiator', 'anakin\'s_eta-2_starfighter', 'clone_sergeant\'s_arc-170', 'umbaran_starfighter','ahsoka_tano\'s_jedi_starfighter', 'plo_koon\'s_jedi_starfighter', 'rex\'s_arc-170', 'jedi_consular\'s_starfighter']
             },
             {
				id:33,
				name: 'JKL Lead (Required: Jedi)',
				toons: ['jedi_knight_luke_skywalker', 'hermit_yoda', 'obi-wan_kenobi_(old_ben)', 'grand_master_yoda', 'aayla_secura'],
			 },
			 {
				id: 34,
				name: 'Shaak-ti Lead Clones',
				toons: ['shaak_ti', 'arc_trooper', 'ct-21-0408__echo_', 'ct-7567__rex_', 'ct-5555__fives_']
				
			},
			{
				id: 35,
				name: 'GAS Lead Clones',
				toons: ['general_skywalker', 'arc_trooper', 'ct-21-0408__echo_', 'ct-7567__rex_', 'ct-5555__fives_']
				
			},
			{
                id:36,
                name: 'Padme Republic  (Required: Galactic Republic)',
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','c-3po', 'ahsoka_tano'],
             },
             {
                id:37,
                name: 'Padme Republic' ,
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','c-3po', 'ahsoka_tano'],
             },
             {
				id: 38,
				name: 'Required: Galactic Republic Jedi, 22k+ Power',
				toons: ['general_kenobi', 'jedi_knight_anakin','grand_master_yoda','ahsoka_tano','barriss_offee',]
				
			},
			{
				id: 39,
				name: 'Unknown (Required: Jedi, 23k+ Power)',
				toons: ['unknown', 'unknown','unknown','unknown','unknown',]
				
			},
			{
				id: 40,
				name: 'Required: GAS & 501st, 23k+ Power',
				toons: ['general_skywalker', 'ct-21-0408__echo_','ct-7567__rex_','arc_trooper','ct-5555__fives_',]
				
			},
			{
				id: 41,
				name: 'Required: Galactic Republic, Padme, JKA, GK, 23k+ Power',
				toons: ['padmé_amidala', 'jedi_knight_anakin','general_kenobi','commander_ahsoka_tano','gl_kenobi',]
				
			},
			{
				id: 42,
				name: 'Resistance (GL Rey or oFinn Lead) (variants available)',
				toons: ['gl_rey', 'resistance_hero_finn','resistance_hero_poe','amilyn_holdo','rey_(jedi_training)',]
				
			},
			 {
				id:43,
				name: 'JKR Jedi with GAS (Required: Jedi)',
				toons: ['jedi_knight_revan', 'bastila_shan', 'jolee_bindo', 'general_skywalker', 'grand_master_yoda'],
				 
			 },
			 {
				id:44,
				name: 'Rebels (Either CLS or oROLO Lead)',
				toons: ['commander_luke_skywalker', 'chewbacca', 'han_solo', 'threepio_&_chewie', 'c-3po'],
				 
			 },
			 {
				id:45,
				name: 'Rebel Fighters',
				toons: ['mon_mothma', 'pao', 'hoth_rebel_scout', 'cara_dune', 'kyle_katarn_o'],
				 
			 },
			 {
				 id:46,
				 name: 'Galactic Legend Luke (Required: Jedi) (variants available)',
				 toons: [ 'jedi_knight_luke_skywalker','gl_luke','hermit_yoda','jolee_bindo','jedi_knight_revan',],
			 },
			 {
				 id:47,
				 name: 'Galactic Legend Luke (Required: Jedi, 23k+ Power) (variants available)',
				 toons: ['jedi_knight_luke_skywalker','gl_luke','hermit_yoda','jolee_bindo','jedi_knight_revan',],
			 },
			 {
				 id:48,
				 name: 'Galactic Legend Luke (Required: Jedi) (variants available)',
				 toons: ['jedi_knight_luke_skywalker','gl_luke', 'hermit_yoda','jolee_bindo','jedi_knight_revan',],
			 },
			 {
                id:49,
                name: 'Padme Republic Without Snips (Required: Galactic Republic)',
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','c-3po', 'barriss_offee'],
             },
             {
				id: 50,
				name: 'Shaak-ti Lead Clones (Required: Galactic Republic)',
				toons: ['shaak_ti', 'arc_trooper', 'ct-21-0408__echo_', 'ct-7567__rex_', 'ct-5555__fives_']
				
			 },
			 {
				id: 51,
				name: 'Home One Rebel Fleet',
				toons: ['home_one', 'han\'s_millennium_falcon', 'biggs_darklighter\'s_x-wing', 'bistan\'s_u-wing', 'rebel_y-wing', 'phantom_ii', 'cassian\'s_u-wing','ghost']
				
		 	 },
		 	 {
				id: 52,
				name: 'Raddus Resistance Fleet',
				toons: ['raddus','poe_dameron\'s_x-wing','rey\'s_millennium_falcon', 'biggs_darklighter\'s_x-wing', 'han\'s_millennium_falcon', 'ebon_hawk', "lando\'s_millennium_falcon","resistance_x-wing"]
				
		 	 },
             {
                id:53,
                name: 'Padme Republic (Required: Padme, Galactic Republic 16.5k+ Power)',
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','c-3po', 'ahsoka_tano'],
             },
             {
				id: 54,
				name: 'Shaak-ti Lead Clones (Required: Galactic Republic, 21k+ Power)',
				toons: ['shaak_ti', 'arc_trooper', 'ct-21-0408__echo_', 'ct-7567__rex_', 'ct-5555__fives_']
				
			 },
             {
                id:55,
                name: 'Padme Republic Without Snips (Required: Galactic Republic, 21k+ Power)',
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','commander_ahsoka_tano', 'r2-d2'],
             },
             {
				 id:56,
				 name: 'Galactic Legend Luke (Required: Jedi, 21k+ Power) (variants available)',
				 toons: [ 'jedi_knight_luke_skywalker','gl_luke','hermit_yoda','jolee_bindo','jedi_knight_revan',],
			 },
			 {
				id:57,
				name: 'JKL Lead (Required: Jedi, 21k+ Power)',
				toons: ['jedi_knight_luke_skywalker', 'hermit_yoda', 'obi-wan_kenobi_(old_ben)', 'grand_master_yoda', 'aayla_secura'],
			 },
			 {
				id:58,
				name: 'JKR Jedi (Required: Jedi, 21k+ Power)',
				toons: ['jedi_knight_revan', 'bastila_shan', 'jolee_bindo', 'hermit_yoda', 'grand_master_yoda'],
				 
			 },
			 {
				 id:59,
				 name: 'Galactic Legend Luke (Required: Jedi, 22k+ Power) (variants available)',
				 toons: [ 'jedi_knight_luke_skywalker','gl_luke','hermit_yoda','jolee_bindo','jedi_knight_revan',],
			 },
			 {
				id:60,
				name: 'JKL Lead (Required: Jedi, 22k+ Power)',
				toons: ['jedi_knight_luke_skywalker', 'hermit_yoda', 'obi-wan_kenobi_(old_ben)', 'grand_master_yoda', 'aayla_secura'],
			 },
			 {
				id:61,
				name: 'JKR Jedi (Required: Jedi, 22k+ Power)',
				toons: ['jedi_knight_revan', 'bastila_shan', 'jolee_bindo', 'hermit_yoda', 'grand_master_yoda'],
				 
			 },
			 {
				id:62,
				name: 'JKR Jedi with GAS (Required: Jedi, 22k+ Power)',
				toons: ['jedi_knight_revan', 'bastila_shan', 'jolee_bindo', 'general_skywalker', 'grand_master_yoda'],
				 
			 },
			 {
                id:63,
                name: 'Padme Republic With CAT (Required: Padme, Galactic Republic 16.5k+ Power)',
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','commander_ahsoka_tano', 'r2-d2'],
             },
             {
				id: 64,
				name: 'Required: Galactic Republic, Padme, JKA, GK, 23k+ Power',
				toons: ['padmé_amidala', 'jedi_knight_anakin','general_kenobi','ahsoka_tano','commander_ahsoka_tano',]
				
  			 },
			 {
				id: 65,
				name: 'Galactic Legend Kenobi (Required: Jedi) (Variants Available)',
				toons: ['gl_kenobi', 'general_skywalker','ahsoka_tano','aayla_secura','mace_windu',]
				
			 },
			 {
				id: 66,
				name: 'Galactic Legend Kenobi (Required: Jedi, 21k+ Power) (Variants Available)',
				toons: ['gl_kenobi', 'general_kenobi','grand_master_yoda','aayla_secura','mace_windu',]
				
			 },
             {
				id: 67,
				name: 'Galactic Legend Kenobi (Required: Jedi, 22k+ Power) (Variants Available)',
				toons: ['gl_kenobi', 'general_skywalker','aayla_secura','general_kenobi','ahsoka_tano',]
				
			 },
			 {
				id: 68,
				name: 'Galactic Legend Kenobi (Required: GR Jedi, 22k+ Power) (Variants Available)',
				toons: ['gl_kenobi', 'general_skywalker','aayla_secura','mace_windu','ahsoka_tano',]
				
			 },
			 {
				id: 69,
				name: 'Galactic Legend Kenobi (Required: GR, 21k+ Power) (Variants Available)',
				toons: ['gl_kenobi', 'mace_windu','commander_ahsoka_tano','aayla_secura','padmé_amidala',]
				
			 },
			 {
				id: 70,
				name: 'Bad Batch (22k+ Power)',
				toons: ['hunter', 'echo','wrecker','tech','omega',]
				
			 },
			 {
				id: 71,
				name: 'Padme 501st (Required Padme, Galactic Republic 16.5k+ Power )',
				toons: ['padmé_amidala','arc_trooper', 'ct-21-0408__echo_', 'ct-7567__rex_', 'ct-5555__fives_']
				
			 },
             {
                id:72,
                name: 'Padme Republic',
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','commander_ahsoka_tano', 'r2-d2'],
             },
             {
                id:73,
                name: 'Lord Vader (solo)',
                toons: ['gl_vader','noone','noone','noone','noone']
             },
             {
				id: 74,
				name: 'Galactic Legend Kylo',
				toons: ['gl_kylo', 'first_order_officer', 'kylo_ren_(unmasked)','general_hux','sith_trooper'],
                video: 'https://youtu.be/GWRtcATtOho?t=291',
                videosource: "bd"
				
			 },
			 {
                id:75,
                name: 'Lord Vader',
                toons: ['gl_vader','maul','royal_guard','admiral_piett','darth_vader'],
                video: 'https://youtu.be/GWRtcATtOho?t=414',
                videosource: "bd"
             },
             {
				id: 76,
				name: 'SEE with Wat and Trio or with Sith Empire',
				toons: ['gl_palp', 'wat_tambor', 'darth_nihilus','darth_sion','darth_traya'],
				video: "https://www.youtube.com/watch?v=GWRtcATtOho&t=662s",
				videosource: "bd"
				
			 },
             {
                id:77,
                name: 'Inquisitors',
                toons: ['grand_inquisitor', 'seventh_sister', 'ninth_sister', 'fifth_brother','eighth_brother'],
                video: 'https://youtu.be/GWRtcATtOho?t=536',
                videosource: "bd"
             },
             {
                id:78,
                name: 'Bounty Hunters with Wat and BobaSOJ/Fennec',
                toons: ['bossk', 'boba_fett', 'jango_fett', 'boba_soj','wat_tambor'],
                video: "https://www.youtube.com/watch?v=enArZ-wAySo",
                videosource: "gs"
             },
             {
				id: 79,
				name: 'Galactic Legend Kylo',
				toons: ['gl_kylo', 'first_order_officer', 'kylo_ren_(unmasked)','general_hux','sith_trooper'],
				video: "https://youtu.be/XQ0ML_qnRtY?t=232",
				videosource: "bd"
				
			 },
             {
                id:80,
                name: 'Lord Vader',
                toons: ['gl_vader','maul','royal_guard','admiral_piett','darth_vader'],
                video: "https://www.youtube.com/watch?v=3EUB7pnqIIQ&t=190s",
                videosource: "bd"
             },
             {
                id:81,
                name: 'Inquisitors',
                toons: ['grand_inquisitor', 'seventh_sister', 'ninth_sister', 'fifth_brother','eighth_brother'],
                video: "https://youtu.be/3EUB7pnqIIQ?t=104",
                videosource: "bd"
             },
             			 {
				id: 82,
				name: 'Trench + Seps',
				toons: ['admiral_trench', 'nute_gunrey', 'jango_fett','count_dooku', 'wat_tambor' ],
				video: "https://youtu.be/3EUB7pnqIIQ?t=320",
				videosource: "bd"
			 },
			              {
                id:83,
                name: 'Lord Vader',
                toons: ['gl_vader','maul','royal_guard','admiral_piett','darth_vader'],
                video: "https://www.youtube.com/live/53171nJlggY?feature=share&t=2991",
                videosource: "bd"
             },
                          {
				id: 84,
				name: 'Galactic Legend Kylo',
				toons: ['gl_kylo', 'first_order_officer', 'kylo_ren_(unmasked)','general_hux','sith_trooper'],
			 }
             



		],
		enemies: [
		'B2 Rocket Droid',//0
		'Command Battle Droid',//1
	    'Count Dooku', //2
	    'General Grevious',//3
	    'General Kalani',//4
	    'Geonosian Brood Alpha', //5
	    'Jango Fett',//6
	    'Nute Gunray', //7	
	    'Poggle the Lesser',//8
	    'Reek',//9
	    'T-Series Tactical Droid',//10
	    'Wat Tambor', //11 
	    'Executrix',//12
	    'Malevolence',//13
	    'Chimaera',//14        
	    'Nexu',//15 
	    'Hound\'s Tooth',//16	
        'Wave 1: Wat Tambor (L), Nute Gunray, Poggle the Lesser',
        'Wave 2: Jedi Master Kenobi',
        'Wave 1: Command Battle Droid (L), 2x Magnaguard, B2, B1, Droideka',
        "Wave 2: Nute Gunray (L), 2x Magnaguard, 2x B2, Security Battle Droid",//20
        "Wave 2: Wat Tambor (L), 2x Magnaguard, 2x B2, Security Battle Droid",
        "Wave 2: Geonosian Brood Alpha (L), Geo Spy, Geo Soldier, Poggle, Sun Fac",
        "Malevolence, Hyena Bomber, Vulture Droid, Geo Starfighter",
        "Malevolence, Sun Fac's Starfigher, Geo Spy's Starfighter, Geo Starfighter",
        "Wave 1: Geonosian Brood Alpha (L), Geo Spy, Geo Soldier, Poggle, Sun Fac",//25
        "Wave 2: Nexu",
        "Wave 1: Geonosian Brood Alpha, Geonosian Soldier, Reek",
        "Wave 1: Acklay",
        "Wave 1: 3x Partisan Fighter, 2x Rebel Spy",
        "Wave 2: Kanan Jarrus (L), Ezra Bridger, Chopper, Rex, Partisan Fighter"//30
		],
		platoons: [
        ["Boba Fett, Scion of Jango",	"7", "Darth Revan",	"6",
"Scythe",	"6","Darth Malgus",	"5",
"TIE/IN Interceptor Prototype",	"5","Chimaera",	"4","Emperor Palpatine",	"4",
"Grand Admiral Thrawn",	"4","Maul",	"4","Darth Malak",	"3","Grand Inquisitor",	"3",
"Imperial Probe Droid",	"3","Starkiller",	"3","B2 Super Battle Droid",	"2",
"Executor",	"2","First Order Officer",	"2","Kylo Ren (Unmasked)",	"2","Sith Eternal Emperor",	"2",
"Supreme Leader Kylo Ren",	"2","Wat Tambor",	"2",
"Asajj Ventress",	"1","Cad Bane",	"1","Colonel Starck",	"1",
"Darth Talon",	"1","Death Trooper",	"1","Dengar",	"1","Droideka",	"1",
"Emperor's Shuttle",	"1","Executrix",	"1","General Grievous",	"1","General Veers",	"1","HK-47",	"1","Hyena Bomber",	"1",
"Kylo Ren's Command Shuttle",	"1","Magmatrooper",	"1","Malevolence",	"1",
"Scimitar",	"1","TIE Echelon",	"1","TIE Reaper",	"1",]
		],
		guides:[
		'See also: 50 Shards of Kam Discord Server',
		'Its Just Ian Modding and Strategy: www.youtube.com/watch?v=9eLKxWumn_Y',
		'McMole2 Defeat the Reek: www.youtube.com/watch?v=ktfNTjiUiGY',
		'Mikayas Sky & Ahsoka guide www.youtube.com/watch?v=rWu4qahiA-g',
		'BitDynasty GAS + Ahsoka guide: www.youtube.com/watch?v=mV7PPNRL2Nc',
		'Z-Gaming JTR with C3P0: www.youtube.com/watch?v=rOqVwTLFMOE',//5
		'DBofficial G10 SARGE guide: www.youtube.com/watch?v=QPfu0URQliU&',//6
		'Warrior SWGOH Livestream t/s 10:06: www.youtube.com/watch?v=YAP5s-bavXE',//7
		'Bulldog g12 JKL destorys LS geo tb: www.youtube.com/watch?v=g_co0UtkMvA',//8
		],
        modifiers:[
        'mod 1',
        'mod 2'
        ],
        notes:[
        'With Lord Vader\'s ultimate ability, this can be done on full auto',
        'Unclear if this is even possible right now',
        "Currently Bugged! Granted ability not working"
        ],
        reqs:[
        'Lord Vader (Relic 5+)',
        '5x Dark Side or Neutral (Relic 5+)',
        'Dark Side Ships (7-Star), Scythe',
        'Dark Side Ships (7-Star)',
        '5x Dark Side or Neutral (Relic 6+)',//4
        '5x Geonosian (Relic 7+)',//5
        ],
		platims:[
		'Phase 2 DS Geonosis (Self)',//0
        'Phase 3 DS Dathomir',
        'Phase 4 DS Haven-class Medical Station'
		],
		missions: [{
			id: 0,
			name: 'c1',
			type: 'usual',
			position: 'left',
			rewards: [
				'Wave 1: 125,000',
                'Wave 2: 250,000'
				],
            preferredSquads: [74,80],
			dangerousEnemies: [25,26],//nexu
            reqs: [4],
			},	{
			id: 1,
			name: 'c2',
			type: 'usual',
			position: 'right',
			rewards: [
                'Wave 1: 250,000'
				],
			preferredSquads: [79,75,78,81],
			dangerousEnemies: [28],//acklay
            reqs: [4],
			}, {
			id: 2,
			name: 'c3',
			type: 'usual',
			position: 'right',
			rewards: [
                'Wave 1: 250,000'
				],
            preferredSquads: [76,77,83,84,82],
			dangerousEnemies: [27],//reek
            reqs: [4],
			},
			{
			id: 4,
			name: 'c5',//wn
			type: 'usual',
			position: 'right',
			rewards: [
				'Wave 1: 125,000',
                'Wave 2: 250,000'
				],
            preferredSquads: [7],
			dangerousEnemies: [29,30],//geo
            reqs: [5],
			}, 
			
			{
			id: 5,
			name: 'c6',
			type: 'fleet',
			position: 'right',
			rewards: [
				'Wave 1: 500,000',
				],
				preferredSquads: [24],
				dangerousEnemies: [24],
            reqs: [3],
            notes: [1]
			}, 
            {
			id: 6,
			name: 'c7',
			type: 'deploy',
			position: 'right',
            stars: [
               '1 Star: 148,125,000',
               '2 Stars: 237,000,000',
               '3 Stars: 316,000,000',
               '3 Stars after maximum preload: 167,875,000 ',
            ]
			}, 
			{id: 30, name: 'm2', type: 'platoon', position: 'right',preqs:["Characters: Relic 6","Ships: 7-Star"], requiredToons: [0], platzones: [0,1,2]}
		],
		selectedMission: '',
		seen: false,
	}
	},
	template: '#mission',
	methods: {
		mq () {
			this.isMobile = window.matchMedia('(max-width: 600px)').matches;
		},	
        hide: function() {
			    this.seen = false;
		}
	},
})


let app = new Vue({
	el: '#app',
	data: {
		isVisible: false
	},
});
