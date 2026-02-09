// Comprehensive local nutrition database - no API calls needed (100% free)
// Values are per 100g unless otherwise noted

const NUTRITION_DB = {
    // ===== FRUITS =====
    apple: { calories: 52, protein_g: 0.3, carbs_g: 14, fat_g: 0.2, fiber_g: 2.4, sugar_g: 10.4, sodium_mg: 1, potassium_mg: 107, calcium_mg: 6, iron_mg: 0.1, vitamin_a_mcg: 3, vitamin_c_mg: 4.6, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.2, vitamin_k_mcg: 2.2, zinc_mg: 0, magnesium_mg: 5, folate_mcg: 3, omega_3_mg: 9, category: 'Fruits' },
    banana: { calories: 89, protein_g: 1.1, carbs_g: 23, fat_g: 0.3, fiber_g: 2.6, sugar_g: 12.2, sodium_mg: 1, potassium_mg: 358, calcium_mg: 5, iron_mg: 0.3, vitamin_a_mcg: 3, vitamin_c_mg: 8.7, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.1, vitamin_k_mcg: 0.5, zinc_mg: 0.2, magnesium_mg: 27, folate_mcg: 20, omega_3_mg: 27, category: 'Fruits' },
    orange: { calories: 47, protein_g: 0.9, carbs_g: 12, fat_g: 0.1, fiber_g: 2.4, sugar_g: 9.4, sodium_mg: 0, potassium_mg: 181, calcium_mg: 40, iron_mg: 0.1, vitamin_a_mcg: 11, vitamin_c_mg: 53.2, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.2, vitamin_k_mcg: 0, zinc_mg: 0.1, magnesium_mg: 10, folate_mcg: 30, omega_3_mg: 7, category: 'Fruits' },
    strawberry: { calories: 32, protein_g: 0.7, carbs_g: 7.7, fat_g: 0.3, fiber_g: 2, sugar_g: 4.9, sodium_mg: 1, potassium_mg: 153, calcium_mg: 16, iron_mg: 0.4, vitamin_a_mcg: 1, vitamin_c_mg: 58.8, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.3, vitamin_k_mcg: 2.2, zinc_mg: 0.1, magnesium_mg: 13, folate_mcg: 24, omega_3_mg: 65, category: 'Fruits' },
    grapes: { calories: 69, protein_g: 0.7, carbs_g: 18.1, fat_g: 0.2, fiber_g: 0.9, sugar_g: 15.5, sodium_mg: 2, potassium_mg: 191, calcium_mg: 10, iron_mg: 0.4, vitamin_a_mcg: 3, vitamin_c_mg: 3.2, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.2, vitamin_k_mcg: 14.6, zinc_mg: 0.1, magnesium_mg: 7, folate_mcg: 2, omega_3_mg: 11, category: 'Fruits' },
    mango: { calories: 60, protein_g: 0.8, carbs_g: 15, fat_g: 0.4, fiber_g: 1.6, sugar_g: 13.7, sodium_mg: 1, potassium_mg: 168, calcium_mg: 11, iron_mg: 0.2, vitamin_a_mcg: 54, vitamin_c_mg: 36.4, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.9, vitamin_k_mcg: 4.2, zinc_mg: 0.1, magnesium_mg: 10, folate_mcg: 43, omega_3_mg: 0, category: 'Fruits' },
    blueberry: { calories: 57, protein_g: 0.7, carbs_g: 14.5, fat_g: 0.3, fiber_g: 2.4, sugar_g: 10, sodium_mg: 1, potassium_mg: 77, calcium_mg: 6, iron_mg: 0.3, vitamin_a_mcg: 3, vitamin_c_mg: 9.7, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.6, vitamin_k_mcg: 19.3, zinc_mg: 0.2, magnesium_mg: 6, folate_mcg: 6, omega_3_mg: 58, category: 'Fruits' },
    avocado: { calories: 160, protein_g: 2, carbs_g: 8.5, fat_g: 14.7, fiber_g: 6.7, sugar_g: 0.7, sodium_mg: 7, potassium_mg: 485, calcium_mg: 12, iron_mg: 0.6, vitamin_a_mcg: 7, vitamin_c_mg: 10, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 2.1, vitamin_k_mcg: 21, zinc_mg: 0.6, magnesium_mg: 29, folate_mcg: 81, omega_3_mg: 110, category: 'Fruits' },
    watermelon: { calories: 30, protein_g: 0.6, carbs_g: 7.6, fat_g: 0.2, fiber_g: 0.4, sugar_g: 6.2, sodium_mg: 1, potassium_mg: 112, calcium_mg: 7, iron_mg: 0.2, vitamin_a_mcg: 28, vitamin_c_mg: 8.1, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.1, vitamin_k_mcg: 0.1, zinc_mg: 0.1, magnesium_mg: 10, folate_mcg: 3, omega_3_mg: 2, category: 'Fruits' },
    pineapple: { calories: 50, protein_g: 0.5, carbs_g: 13.1, fat_g: 0.1, fiber_g: 1.4, sugar_g: 9.9, sodium_mg: 1, potassium_mg: 109, calcium_mg: 13, iron_mg: 0.3, vitamin_a_mcg: 3, vitamin_c_mg: 47.8, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0, vitamin_k_mcg: 0.7, zinc_mg: 0.1, magnesium_mg: 12, folate_mcg: 18, omega_3_mg: 17, category: 'Fruits' },

    // ===== VEGETABLES =====
    broccoli: { calories: 34, protein_g: 2.8, carbs_g: 7, fat_g: 0.4, fiber_g: 2.6, sugar_g: 1.7, sodium_mg: 33, potassium_mg: 316, calcium_mg: 47, iron_mg: 0.7, vitamin_a_mcg: 31, vitamin_c_mg: 89.2, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.8, vitamin_k_mcg: 101.6, zinc_mg: 0.4, magnesium_mg: 21, folate_mcg: 63, omega_3_mg: 21, category: 'Vegetables' },
    carrot: { calories: 41, protein_g: 0.9, carbs_g: 10, fat_g: 0.2, fiber_g: 2.8, sugar_g: 4.7, sodium_mg: 69, potassium_mg: 320, calcium_mg: 33, iron_mg: 0.3, vitamin_a_mcg: 835, vitamin_c_mg: 5.9, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.7, vitamin_k_mcg: 13.2, zinc_mg: 0.2, magnesium_mg: 12, folate_mcg: 19, omega_3_mg: 2, category: 'Vegetables' },
    spinach: { calories: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4, fiber_g: 2.2, sugar_g: 0.4, sodium_mg: 79, potassium_mg: 558, calcium_mg: 99, iron_mg: 2.7, vitamin_a_mcg: 469, vitamin_c_mg: 28.1, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 2, vitamin_k_mcg: 482.9, zinc_mg: 0.5, magnesium_mg: 79, folate_mcg: 194, omega_3_mg: 138, category: 'Vegetables' },
    tomato: { calories: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2, fiber_g: 1.2, sugar_g: 2.6, sodium_mg: 5, potassium_mg: 237, calcium_mg: 10, iron_mg: 0.3, vitamin_a_mcg: 42, vitamin_c_mg: 13.7, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.5, vitamin_k_mcg: 7.9, zinc_mg: 0.2, magnesium_mg: 11, folate_mcg: 15, omega_3_mg: 3, category: 'Vegetables' },
    potato: { calories: 77, protein_g: 2, carbs_g: 17, fat_g: 0.1, fiber_g: 2.2, sugar_g: 0.8, sodium_mg: 6, potassium_mg: 421, calcium_mg: 12, iron_mg: 0.8, vitamin_a_mcg: 0, vitamin_c_mg: 19.7, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0, vitamin_k_mcg: 2, zinc_mg: 0.3, magnesium_mg: 23, folate_mcg: 15, omega_3_mg: 10, category: 'Vegetables' },
    onion: { calories: 40, protein_g: 1.1, carbs_g: 9.3, fat_g: 0.1, fiber_g: 1.7, sugar_g: 4.2, sodium_mg: 4, potassium_mg: 146, calcium_mg: 23, iron_mg: 0.2, vitamin_a_mcg: 0, vitamin_c_mg: 7.4, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0, vitamin_k_mcg: 0.4, zinc_mg: 0.2, magnesium_mg: 10, folate_mcg: 19, omega_3_mg: 4, category: 'Vegetables' },
    bell_pepper: { calories: 31, protein_g: 1, carbs_g: 6, fat_g: 0.3, fiber_g: 2.1, sugar_g: 4.2, sodium_mg: 4, potassium_mg: 211, calcium_mg: 7, iron_mg: 0.4, vitamin_a_mcg: 157, vitamin_c_mg: 127.7, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 1.6, vitamin_k_mcg: 4.9, zinc_mg: 0.3, magnesium_mg: 12, folate_mcg: 46, omega_3_mg: 7, category: 'Vegetables' },
    lettuce: { calories: 15, protein_g: 1.4, carbs_g: 2.9, fat_g: 0.2, fiber_g: 1.3, sugar_g: 0.8, sodium_mg: 28, potassium_mg: 194, calcium_mg: 36, iron_mg: 0.9, vitamin_a_mcg: 370, vitamin_c_mg: 9.2, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.3, vitamin_k_mcg: 126.3, zinc_mg: 0.2, magnesium_mg: 13, folate_mcg: 38, omega_3_mg: 58, category: 'Vegetables' },
    cucumber: { calories: 15, protein_g: 0.7, carbs_g: 3.6, fat_g: 0.1, fiber_g: 0.5, sugar_g: 1.7, sodium_mg: 2, potassium_mg: 147, calcium_mg: 16, iron_mg: 0.3, vitamin_a_mcg: 5, vitamin_c_mg: 2.8, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0, vitamin_k_mcg: 16.4, zinc_mg: 0.2, magnesium_mg: 13, folate_mcg: 7, omega_3_mg: 5, category: 'Vegetables' },
    sweet_potato: { calories: 86, protein_g: 1.6, carbs_g: 20.1, fat_g: 0.1, fiber_g: 3, sugar_g: 4.2, sodium_mg: 55, potassium_mg: 337, calcium_mg: 30, iron_mg: 0.6, vitamin_a_mcg: 709, vitamin_c_mg: 2.4, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.3, vitamin_k_mcg: 1.8, zinc_mg: 0.3, magnesium_mg: 25, folate_mcg: 11, omega_3_mg: 0, category: 'Vegetables' },
    garlic: { calories: 149, protein_g: 6.4, carbs_g: 33.1, fat_g: 0.5, fiber_g: 2.1, sugar_g: 1, sodium_mg: 17, potassium_mg: 401, calcium_mg: 181, iron_mg: 1.7, vitamin_a_mcg: 0, vitamin_c_mg: 31.2, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0, vitamin_k_mcg: 1.7, zinc_mg: 1.2, magnesium_mg: 25, folate_mcg: 3, omega_3_mg: 20, category: 'Vegetables' },
    mushroom: { calories: 22, protein_g: 3.1, carbs_g: 3.3, fat_g: 0.3, fiber_g: 1, sugar_g: 2, sodium_mg: 5, potassium_mg: 318, calcium_mg: 3, iron_mg: 0.5, vitamin_a_mcg: 0, vitamin_c_mg: 2.1, vitamin_d_mcg: 0.2, vitamin_b12_mcg: 0, vitamin_e_mg: 0, vitamin_k_mcg: 0, zinc_mg: 0.5, magnesium_mg: 9, folate_mcg: 17, omega_3_mg: 0, category: 'Vegetables' },

    // ===== PROTEINS =====
    chicken_breast: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, sugar_g: 0, sodium_mg: 74, potassium_mg: 256, calcium_mg: 15, iron_mg: 1, vitamin_a_mcg: 6, vitamin_c_mg: 0, vitamin_d_mcg: 0.1, vitamin_b12_mcg: 0.3, vitamin_e_mg: 0.3, vitamin_k_mcg: 0, zinc_mg: 1, magnesium_mg: 29, folate_mcg: 4, omega_3_mg: 40, category: 'Protein' },
    salmon: { calories: 208, protein_g: 20, carbs_g: 0, fat_g: 13, fiber_g: 0, sugar_g: 0, sodium_mg: 59, potassium_mg: 363, calcium_mg: 12, iron_mg: 0.3, vitamin_a_mcg: 12, vitamin_c_mg: 0, vitamin_d_mcg: 11.1, vitamin_b12_mcg: 3.2, vitamin_e_mg: 3.6, vitamin_k_mcg: 0.5, zinc_mg: 0.6, magnesium_mg: 27, folate_mcg: 7, omega_3_mg: 2260, category: 'Protein' },
    eggs: { calories: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11, fiber_g: 0, sugar_g: 1.1, sodium_mg: 124, potassium_mg: 126, calcium_mg: 56, iron_mg: 1.8, vitamin_a_mcg: 160, vitamin_c_mg: 0, vitamin_d_mcg: 2.1, vitamin_b12_mcg: 0.9, vitamin_e_mg: 1.1, vitamin_k_mcg: 0.3, zinc_mg: 1.3, magnesium_mg: 12, folate_mcg: 47, omega_3_mg: 37, category: 'Protein' },
    beef: { calories: 250, protein_g: 26, carbs_g: 0, fat_g: 15, fiber_g: 0, sugar_g: 0, sodium_mg: 72, potassium_mg: 318, calcium_mg: 18, iron_mg: 2.6, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0.1, vitamin_b12_mcg: 2.6, vitamin_e_mg: 0.1, vitamin_k_mcg: 1.4, zinc_mg: 6.3, magnesium_mg: 21, folate_mcg: 7, omega_3_mg: 50, category: 'Protein' },
    tofu: { calories: 76, protein_g: 8, carbs_g: 1.9, fat_g: 4.8, fiber_g: 0.3, sugar_g: 0.6, sodium_mg: 7, potassium_mg: 121, calcium_mg: 350, iron_mg: 5.4, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0, vitamin_k_mcg: 2.4, zinc_mg: 0.8, magnesium_mg: 30, folate_mcg: 15, omega_3_mg: 400, category: 'Protein' },
    tuna: { calories: 130, protein_g: 28, carbs_g: 0, fat_g: 1, fiber_g: 0, sugar_g: 0, sodium_mg: 40, potassium_mg: 444, calcium_mg: 10, iron_mg: 1, vitamin_a_mcg: 18, vitamin_c_mg: 0, vitamin_d_mcg: 1.7, vitamin_b12_mcg: 2.9, vitamin_e_mg: 0.2, vitamin_k_mcg: 0, zinc_mg: 0.8, magnesium_mg: 50, folate_mcg: 2, omega_3_mg: 270, category: 'Protein' },
    shrimp: { calories: 85, protein_g: 20, carbs_g: 0.2, fat_g: 0.5, fiber_g: 0, sugar_g: 0, sodium_mg: 119, potassium_mg: 182, calcium_mg: 64, iron_mg: 0.5, vitamin_a_mcg: 2, vitamin_c_mg: 0, vitamin_d_mcg: 0.2, vitamin_b12_mcg: 1.1, vitamin_e_mg: 1.2, vitamin_k_mcg: 0.3, zinc_mg: 1.6, magnesium_mg: 35, folate_mcg: 3, omega_3_mg: 540, category: 'Protein' },
    turkey: { calories: 135, protein_g: 30, carbs_g: 0, fat_g: 1, fiber_g: 0, sugar_g: 0, sodium_mg: 55, potassium_mg: 305, calcium_mg: 10, iron_mg: 1.1, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0.1, vitamin_b12_mcg: 0.4, vitamin_e_mg: 0.1, vitamin_k_mcg: 0, zinc_mg: 2, magnesium_mg: 27, folate_mcg: 6, omega_3_mg: 40, category: 'Protein' },

    // ===== DAIRY =====
    milk: { calories: 42, protein_g: 3.4, carbs_g: 5, fat_g: 1, fiber_g: 0, sugar_g: 5, sodium_mg: 44, potassium_mg: 150, calcium_mg: 125, iron_mg: 0, vitamin_a_mcg: 14, vitamin_c_mg: 0, vitamin_d_mcg: 1.3, vitamin_b12_mcg: 0.5, vitamin_e_mg: 0, vitamin_k_mcg: 0.3, zinc_mg: 0.4, magnesium_mg: 11, folate_mcg: 5, omega_3_mg: 0, category: 'Dairy' },
    cheese: { calories: 402, protein_g: 25, carbs_g: 1.3, fat_g: 33, fiber_g: 0, sugar_g: 0.5, sodium_mg: 621, potassium_mg: 98, calcium_mg: 721, iron_mg: 0.7, vitamin_a_mcg: 265, vitamin_c_mg: 0, vitamin_d_mcg: 0.6, vitamin_b12_mcg: 1.1, vitamin_e_mg: 0.3, vitamin_k_mcg: 2.4, zinc_mg: 3.1, magnesium_mg: 28, folate_mcg: 18, omega_3_mg: 364, category: 'Dairy' },
    yogurt: { calories: 59, protein_g: 10, carbs_g: 3.6, fat_g: 0.4, fiber_g: 0, sugar_g: 3.2, sodium_mg: 36, potassium_mg: 141, calcium_mg: 110, iron_mg: 0.1, vitamin_a_mcg: 2, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0.8, vitamin_e_mg: 0, vitamin_k_mcg: 0.2, zinc_mg: 0.6, magnesium_mg: 11, folate_mcg: 11, omega_3_mg: 0, category: 'Dairy' },
    butter: { calories: 717, protein_g: 0.9, carbs_g: 0.1, fat_g: 81, fiber_g: 0, sugar_g: 0.1, sodium_mg: 11, potassium_mg: 24, calcium_mg: 24, iron_mg: 0, vitamin_a_mcg: 684, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0.2, vitamin_e_mg: 2.3, vitamin_k_mcg: 7, zinc_mg: 0.1, magnesium_mg: 2, folate_mcg: 3, omega_3_mg: 315, category: 'Dairy' },

    // ===== GRAINS =====
    rice: { calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, fiber_g: 0.4, sugar_g: 0, sodium_mg: 1, potassium_mg: 35, calcium_mg: 10, iron_mg: 0.2, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0, vitamin_k_mcg: 0, zinc_mg: 0.5, magnesium_mg: 12, folate_mcg: 58, omega_3_mg: 0, category: 'Grains' },
    bread: { calories: 265, protein_g: 9, carbs_g: 49, fat_g: 3.2, fiber_g: 2.7, sugar_g: 5, sodium_mg: 491, potassium_mg: 115, calcium_mg: 260, iron_mg: 3.6, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.3, vitamin_k_mcg: 3.4, zinc_mg: 0.9, magnesium_mg: 25, folate_mcg: 111, omega_3_mg: 0, category: 'Grains' },
    pasta: { calories: 131, protein_g: 5, carbs_g: 25, fat_g: 1.1, fiber_g: 1.8, sugar_g: 0.6, sodium_mg: 1, potassium_mg: 44, calcium_mg: 7, iron_mg: 1.3, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.1, vitamin_k_mcg: 0, zinc_mg: 0.5, magnesium_mg: 18, folate_mcg: 7, omega_3_mg: 0, category: 'Grains' },
    oats: { calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6, sugar_g: 0, sodium_mg: 2, potassium_mg: 429, calcium_mg: 54, iron_mg: 4.7, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.4, vitamin_k_mcg: 2, zinc_mg: 3.6, magnesium_mg: 177, folate_mcg: 56, omega_3_mg: 111, category: 'Grains' },
    quinoa: { calories: 120, protein_g: 4.4, carbs_g: 21.3, fat_g: 1.9, fiber_g: 2.8, sugar_g: 0.9, sodium_mg: 7, potassium_mg: 172, calcium_mg: 17, iron_mg: 1.5, vitamin_a_mcg: 1, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.6, vitamin_k_mcg: 0, zinc_mg: 1.1, magnesium_mg: 64, folate_mcg: 42, omega_3_mg: 50, category: 'Grains' },

    // ===== LEGUMES =====
    lentils: { calories: 116, protein_g: 9, carbs_g: 20, fat_g: 0.4, fiber_g: 7.9, sugar_g: 1.8, sodium_mg: 2, potassium_mg: 369, calcium_mg: 19, iron_mg: 3.3, vitamin_a_mcg: 0, vitamin_c_mg: 1.5, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.1, vitamin_k_mcg: 1.7, zinc_mg: 1.3, magnesium_mg: 36, folate_mcg: 181, omega_3_mg: 36, category: 'Legumes' },
    chickpeas: { calories: 164, protein_g: 8.9, carbs_g: 27, fat_g: 2.6, fiber_g: 7.6, sugar_g: 4.8, sodium_mg: 7, potassium_mg: 291, calcium_mg: 49, iron_mg: 2.9, vitamin_a_mcg: 1, vitamin_c_mg: 1.3, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.4, vitamin_k_mcg: 4, zinc_mg: 1.5, magnesium_mg: 48, folate_mcg: 172, omega_3_mg: 43, category: 'Legumes' },
    black_beans: { calories: 132, protein_g: 8.9, carbs_g: 23.7, fat_g: 0.5, fiber_g: 8.7, sugar_g: 0.3, sodium_mg: 1, potassium_mg: 355, calcium_mg: 27, iron_mg: 2.1, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0, vitamin_k_mcg: 3.3, zinc_mg: 1.1, magnesium_mg: 70, folate_mcg: 149, omega_3_mg: 181, category: 'Legumes' },
    peanuts: { calories: 567, protein_g: 26, carbs_g: 16, fat_g: 49, fiber_g: 8.5, sugar_g: 4, sodium_mg: 18, potassium_mg: 705, calcium_mg: 92, iron_mg: 4.6, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 8.3, vitamin_k_mcg: 0, zinc_mg: 3.3, magnesium_mg: 168, folate_mcg: 240, omega_3_mg: 3, category: 'Legumes' },
    almonds: { calories: 579, protein_g: 21, carbs_g: 22, fat_g: 50, fiber_g: 12.5, sugar_g: 4.4, sodium_mg: 1, potassium_mg: 733, calcium_mg: 269, iron_mg: 3.7, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 25.6, vitamin_k_mcg: 0, zinc_mg: 3.1, magnesium_mg: 270, folate_mcg: 44, omega_3_mg: 6, category: 'Legumes' },

    // ===== OILS & FATS =====
    olive_oil: { calories: 884, protein_g: 0, carbs_g: 0, fat_g: 100, fiber_g: 0, sugar_g: 0, sodium_mg: 2, potassium_mg: 1, calcium_mg: 1, iron_mg: 0.6, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 14.4, vitamin_k_mcg: 60.2, zinc_mg: 0, magnesium_mg: 0, folate_mcg: 0, omega_3_mg: 761, category: 'Oils' },
    coconut_oil: { calories: 862, protein_g: 0, carbs_g: 0, fat_g: 100, fiber_g: 0, sugar_g: 0, sodium_mg: 0, potassium_mg: 0, calcium_mg: 0, iron_mg: 0, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.1, vitamin_k_mcg: 0.5, zinc_mg: 0, magnesium_mg: 0, folate_mcg: 0, omega_3_mg: 0, category: 'Oils' },

    // ===== SNACKS & MISC =====
    dark_chocolate: { calories: 546, protein_g: 5, carbs_g: 60, fat_g: 31, fiber_g: 7, sugar_g: 48, sodium_mg: 24, potassium_mg: 559, calcium_mg: 56, iron_mg: 8, vitamin_a_mcg: 2, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0.3, vitamin_e_mg: 0.6, vitamin_k_mcg: 7.2, zinc_mg: 2.3, magnesium_mg: 146, folate_mcg: 12, omega_3_mg: 30, category: 'Snacks' },
    honey: { calories: 304, protein_g: 0.3, carbs_g: 82.4, fat_g: 0, fiber_g: 0.2, sugar_g: 82.1, sodium_mg: 4, potassium_mg: 52, calcium_mg: 6, iron_mg: 0.4, vitamin_a_mcg: 0, vitamin_c_mg: 0.5, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0, vitamin_k_mcg: 0, zinc_mg: 0.2, magnesium_mg: 2, folate_mcg: 2, omega_3_mg: 0, category: 'Snacks' },

    // ===== BEVERAGES =====
    coffee: { calories: 1, protein_g: 0.1, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 2, potassium_mg: 49, calcium_mg: 2, iron_mg: 0, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0, vitamin_k_mcg: 0, zinc_mg: 0, magnesium_mg: 3, folate_mcg: 0, omega_3_mg: 0, category: 'Beverages' },
    green_tea: { calories: 1, protein_g: 0.2, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 1, potassium_mg: 8, calcium_mg: 0, iron_mg: 0, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0, vitamin_k_mcg: 0, zinc_mg: 0, magnesium_mg: 0, folate_mcg: 1, omega_3_mg: 0, category: 'Beverages' },
    orange_juice: { calories: 45, protein_g: 0.7, carbs_g: 10.4, fat_g: 0.2, fiber_g: 0.2, sugar_g: 8.4, sodium_mg: 1, potassium_mg: 200, calcium_mg: 11, iron_mg: 0.2, vitamin_a_mcg: 10, vitamin_c_mg: 50, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0, vitamin_k_mcg: 0.1, zinc_mg: 0.1, magnesium_mg: 11, folate_mcg: 30, omega_3_mg: 7, category: 'Beverages' },

    // ===== SPICES =====
    ginger: { calories: 80, protein_g: 1.8, carbs_g: 17.8, fat_g: 0.8, fiber_g: 2, sugar_g: 1.7, sodium_mg: 13, potassium_mg: 415, calcium_mg: 16, iron_mg: 0.6, vitamin_a_mcg: 0, vitamin_c_mg: 5, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 0.3, vitamin_k_mcg: 0.1, zinc_mg: 0.3, magnesium_mg: 43, folate_mcg: 11, omega_3_mg: 34, category: 'Spices' },
    cinnamon: { calories: 247, protein_g: 4, carbs_g: 80.6, fat_g: 1.2, fiber_g: 53.1, sugar_g: 2.2, sodium_mg: 10, potassium_mg: 431, calcium_mg: 1002, iron_mg: 8.3, vitamin_a_mcg: 15, vitamin_c_mg: 3.8, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, vitamin_e_mg: 2.3, vitamin_k_mcg: 31.2, zinc_mg: 1.8, magnesium_mg: 60, folate_mcg: 6, omega_3_mg: 11, category: 'Spices' },
};

// Daily recommended values for reference (adults)
export const DAILY_VALUES = {
    calories: 2000,
    protein_g: 50,
    carbs_g: 300,
    fat_g: 65,
    fiber_g: 25,
    sugar_g: 50,
    sodium_mg: 2300,
    potassium_mg: 4700,
    calcium_mg: 1000,
    iron_mg: 18,
    vitamin_a_mcg: 900,
    vitamin_c_mg: 90,
    vitamin_d_mcg: 20,
    vitamin_b12_mcg: 2.4,
    vitamin_e_mg: 15,
    vitamin_k_mcg: 120,
    zinc_mg: 11,
    magnesium_mg: 420,
    folate_mcg: 400,
    omega_3_mg: 1600,
};

// Nutrient display names and units
export const NUTRIENT_INFO = {
    calories: { name: 'Calories', unit: 'kcal', color: '#ff8c42' },
    protein_g: { name: 'Protein', unit: 'g', color: '#4d8dff' },
    carbs_g: { name: 'Carbs', unit: 'g', color: '#fbbf24' },
    fat_g: { name: 'Fat', unit: 'g', color: '#ff6b9d' },
    fiber_g: { name: 'Fiber', unit: 'g', color: '#00d4aa' },
    sugar_g: { name: 'Sugar', unit: 'g', color: '#ef4444' },
    sodium_mg: { name: 'Sodium', unit: 'mg', color: '#a78bfa' },
    potassium_mg: { name: 'Potassium', unit: 'mg', color: '#34d399' },
    calcium_mg: { name: 'Calcium', unit: 'mg', color: '#f0f0f5' },
    iron_mg: { name: 'Iron', unit: 'mg', color: '#f87171' },
    vitamin_a_mcg: { name: 'Vitamin A', unit: 'mcg', color: '#fb923c' },
    vitamin_c_mg: { name: 'Vitamin C', unit: 'mg', color: '#facc15' },
    vitamin_d_mcg: { name: 'Vitamin D', unit: 'mcg', color: '#38bdf8' },
    vitamin_b12_mcg: { name: 'Vitamin B12', unit: 'mcg', color: '#c084fc' },
    vitamin_e_mg: { name: 'Vitamin E', unit: 'mg', color: '#a3e635' },
    vitamin_k_mcg: { name: 'Vitamin K', unit: 'mcg', color: '#2dd4bf' },
    zinc_mg: { name: 'Zinc', unit: 'mg', color: '#94a3b8' },
    magnesium_mg: { name: 'Magnesium', unit: 'mg', color: '#c084fc' },
    folate_mcg: { name: 'Folate', unit: 'mcg', color: '#4ade80' },
    omega_3_mg: { name: 'Omega-3', unit: 'mg', color: '#22d3ee' },
};

/**
 * Fuzzy match a food name to our database
 */
function findFood(name) {
    const normalized = name.toLowerCase().trim()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');

    // Direct match
    if (NUTRITION_DB[normalized]) return NUTRITION_DB[normalized];

    // Partial match - check if any key is contained in the name
    for (const [key, data] of Object.entries(NUTRITION_DB)) {
        const keyWords = key.split('_');
        const nameWords = normalized.split('_');
        if (keyWords.some(kw => nameWords.some(nw => nw.includes(kw) || kw.includes(nw)))) {
            return data;
        }
    }

    // Check if name contains any key
    for (const [key, data] of Object.entries(NUTRITION_DB)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return data;
        }
    }

    return null;
}

/**
 * Look up nutrition for a grocery item.
 * Returns nutrition data scaled by quantity (relative to 100g base).
 */
export function lookupNutrition(itemName, quantityGrams = 100) {
    const food = findFood(itemName);
    if (!food) {
        return null;
    }

    const scale = quantityGrams / 100;
    const result = {};

    for (const [key, value] of Object.entries(food)) {
        if (key === 'category') {
            result[key] = value;
        } else {
            result[key] = Math.round(value * scale * 10) / 10;
        }
    }

    return result;
}

/**
 * Look up nutrition for multiple items
 */
export function lookupBatchNutrition(items) {
    return items.map(item => {
        const nutrition = lookupNutrition(item.name, item.quantity || 100);
        return {
            ...item,
            nutrition,
            matched: nutrition !== null,
        };
    });
}

/**
 * Aggregate nutrition data across multiple items
 */
export function aggregateNutrition(nutritionArray) {
    const totals = {};

    for (const data of nutritionArray) {
        if (!data) continue;
        for (const [key, value] of Object.entries(data)) {
            if (key === 'category') continue;
            totals[key] = (totals[key] || 0) + value;
        }
    }

    // Round all values
    for (const key of Object.keys(totals)) {
        totals[key] = Math.round(totals[key] * 10) / 10;
    }

    return totals;
}

/**
 * Get all food names in the database
 */
export function getAllFoods() {
    return Object.keys(NUTRITION_DB).map(key => ({
        key,
        name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        ...NUTRITION_DB[key],
    }));
}

/**
 * Get food categories
 */
export function getCategories() {
    const categories = new Set();
    for (const food of Object.values(NUTRITION_DB)) {
        categories.add(food.category);
    }
    return [...categories];
}

export default NUTRITION_DB;
