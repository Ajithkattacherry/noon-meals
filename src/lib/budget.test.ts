import { describe, expect, it } from 'vitest'
import {
  reconcileMonthlyBudget,
  summarizeWeekIngredients,
  weeksInMonth,
} from './budget'
import type {
  DailyMenu,
  FixedBill,
  Ingredient,
  Purchase,
  Recipe,
  WeeklyBillAllocation,
} from './types'

describe('weeksInMonth', () => {
  it('returns Monday starts for all Mon–Fri weeks overlapping the month', () => {
    // 2026-11-01 is a Sunday; Monday 2026-11-02 starts the first Mon–Fri week,
    // and Monday 2026-11-30 has Mon 30 Nov inside November.
    expect(weeksInMonth('2026-11')).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
    ])
  })

  it('includes a partial first week when the 1st falls on a weekday', () => {
    // 2026-10-01 is a Thursday; its Monday is 2026-09-28.
    expect(weeksInMonth('2026-10')).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ])
  })
})

describe('reconcileMonthlyBudget', () => {
  it('deducts fixed bills and tracks weekly grocery, vegetable, and snacks allocations', () => {
    const fixedBills: FixedBill[] = [
      {
        id: 'f1',
        monthlyBudgetId: 'b1',
        label: 'Rice',
        billDate: '2026-11-03',
        amount: 12000,
      },
      {
        id: 'f2',
        monthlyBudgetId: 'b1',
        label: 'Transportation',
        billDate: '2026-11-05',
        amount: 2500,
      },
      {
        id: 'f3',
        monthlyBudgetId: 'b1',
        label: 'Gas',
        billDate: '2026-11-10',
        amount: 3500,
      },
    ]

    const allocations: WeeklyBillAllocation[] = [
      {
        id: 'w1',
        monthlyBudgetId: 'b1',
        weekStart: '2026-11-02',
        groceryBill: 5000,
        vegetableBill: 4000,
        snacksBill: 1000,
      },
      {
        id: 'w2',
        monthlyBudgetId: 'b1',
        weekStart: '2026-11-09',
        groceryBill: 6000,
        vegetableBill: 4500,
        snacksBill: 1500,
      },
    ]

    const summary = reconcileMonthlyBudget(50000, fixedBills, allocations)
    expect(summary).toEqual({
      plannedTarget: 50000,
      totalFixed: 18000,
      distributableBudget: 32000,
      totalGrocery: 11000,
      totalVegetable: 8500,
      totalSnacks: 2500,
      totalWeeklyAllocated: 22000,
      totalPlanned: 40000,
      remainingToAllocate: 10000,
    })
  })

  it('returns zero remainingToAllocate when balanced and negative when over-allocated', () => {
    const balanced = reconcileMonthlyBudget(
      20000,
      [{ id: 'f1', monthlyBudgetId: 'b1', label: 'Gas', billDate: '2026-11-01', amount: 5000 }],
      [
        {
          id: 'w1',
          monthlyBudgetId: 'b1',
          weekStart: '2026-11-02',
          groceryBill: 9000,
          vegetableBill: 6000,
          snacksBill: 0,
        },
      ],
    )
    expect(balanced.remainingToAllocate).toBe(0)

    const over = reconcileMonthlyBudget(
      20000,
      [{ id: 'f1', monthlyBudgetId: 'b1', label: 'Gas', billDate: '2026-11-01', amount: 5000 }],
      [
        {
          id: 'w1',
          monthlyBudgetId: 'b1',
          weekStart: '2026-11-02',
          groceryBill: 10000,
          vegetableBill: 6000,
          snacksBill: 0,
        },
      ],
    )
    expect(over.remainingToAllocate).toBe(-1000)
  })
})

describe('summarizeWeekIngredients', () => {
  const ingredients: Ingredient[] = [
    { id: 'onion', name: 'Onion', unit: 'Kg', category: 'vegetable' },
    { id: 'chilli', name: 'Green Chilli', unit: 'Kg', category: 'vegetable' },
    { id: 'dal', name: 'Toor Dal', unit: 'Kg', category: 'grocery' },
    { id: 'poha', name: 'Aval', unit: 'Kg', category: 'snacks' },
    { id: 'rice', name: 'Rice', unit: 'Kg', category: 'fixed' },
  ]

  const recipes: Recipe[] = [
    {
      id: 'sambar',
      name: 'Sambar',
      baseServings: 50,
      items: [
        { ingredientId: 'onion', quantity: 2, unit: 'Kg' },
        { ingredientId: 'chilli', quantity: 250, unit: 'Gram' },
        { ingredientId: 'dal', quantity: 3, unit: 'Kg' },
        { ingredientId: 'rice', quantity: 5, unit: 'Kg' },
      ],
    },
    {
      id: 'snack',
      name: 'Sweet Aval',
      baseServings: 50,
      items: [{ ingredientId: 'poha', quantity: 1, unit: 'Kg' }],
    },
  ]

  const purchases: Purchase[] = [
    { id: 'p1', ingredientId: 'onion', purchaseDate: '2026-11-23', unitPrice: 40, createdAt: '1' },
    { id: 'p2', ingredientId: 'chilli', purchaseDate: '2026-11-23', unitPrice: 80, createdAt: '1' },
    { id: 'p3', ingredientId: 'dal', purchaseDate: '2026-11-23', unitPrice: 120, createdAt: '1' },
  ]

  const menus: DailyMenu[] = [
    {
      id: 'm1',
      menuDate: '2026-11-23', // Mon
      studentCount: 100,
      bufferPercent: 0,
      recipeIds: ['sambar'],
      overrides: {},
      status: 'draft',
      snapshot: null,
      finalizedAt: null,
    },
    {
      id: 'm2',
      menuDate: '2026-11-25', // Wed
      studentCount: 50,
      bufferPercent: 0,
      recipeIds: ['sambar', 'snack'],
      overrides: {},
      status: 'draft',
      snapshot: null,
      finalizedAt: null,
    },
    {
      id: 'm3',
      menuDate: '2026-11-28', // Sat — outside Mon–Fri
      studentCount: 100,
      bufferPercent: 0,
      recipeIds: ['sambar'],
      overrides: {},
      status: 'draft',
      snapshot: null,
      finalizedAt: null,
    },
  ]

  it('aggregates Mon–Fri menus by category and ignores fixed and weekend items', () => {
    const result = summarizeWeekIngredients(
      menus,
      recipes,
      ingredients,
      purchases,
      '2026-11-23',
    )

    expect(result.weekStart).toBe('2026-11-23')
    expect(result.weekEnd).toBe('2026-11-27')
    expect(result.days).toEqual([
      { menuDate: '2026-11-23', weekday: 'Mon', studentCount: 100, recipeNames: ['Sambar'] },
      {
        menuDate: '2026-11-25',
        weekday: 'Wed',
        studentCount: 50,
        recipeNames: ['Sambar', 'Sweet Aval'],
      },
    ])

    // Onion: Mon 4 Kg (160) + Wed 2 Kg (80) = 6 Kg, 240
    // Green Chilli: Mon 0.5 Kg (40) + Wed 0.25 Kg (20) = 0.75 Kg, 60
    expect(result.vegetables).toEqual([
      {
        ingredientId: 'chilli',
        ingredientName: 'Green Chilli',
        category: 'vegetable',
        unit: 'Kg',
        totalQuantity: 0.75,
        estimatedCost: 60,
        hasMissingPrice: false,
      },
      {
        ingredientId: 'onion',
        ingredientName: 'Onion',
        category: 'vegetable',
        unit: 'Kg',
        totalQuantity: 6,
        estimatedCost: 240,
        hasMissingPrice: false,
      },
    ])
    expect(result.estimatedVegetableCost).toBe(300)

    // Dal: Mon 6 Kg (720) + Wed 3 Kg (360) = 9 Kg, 1080
    expect(result.groceries).toHaveLength(1)
    expect(result.groceries[0]).toMatchObject({
      ingredientId: 'dal',
      totalQuantity: 9,
      estimatedCost: 1080,
    })
    expect(result.estimatedGroceryCost).toBe(1080)

    // Aval: Wed 1 Kg, missing price
    expect(result.snacks).toEqual([
      {
        ingredientId: 'poha',
        ingredientName: 'Aval',
        category: 'snacks',
        unit: 'Kg',
        totalQuantity: 1,
        estimatedCost: null,
        hasMissingPrice: true,
      },
    ])
    expect(result.estimatedSnacksCost).toBe(0)
  })
})
