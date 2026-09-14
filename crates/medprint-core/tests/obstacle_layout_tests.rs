//! # MedPrint 空间障碍避让与相对锚点约束自动化测试
//!
//! 验证：
//! 1. 相对锚定对齐（Logo 与标题垂直居中对齐）数学精度；
//! 2. 空间障碍物（TEG 弹力图/超声影像）避让折流，实现 100% 零碰撞几何环绕；
//! 3. 单页硬预算（SinglePageHard）自适应压缩。

use medprint_core::layout::{ObstacleBox, ObstacleLayoutSolver, PhysicalRect};
use medprint_core::schema::{AlertFlag, LabItemRow};
use medprint_core::units::{Margins, PhysicalLength, PhysicalSize};

#[test]
fn test_relative_vertical_center_alignment() {
    // 参考物：医院标题区域 (Y=12.0mm, 高度=16.0mm，中心线为 Y=20.0mm)
    let title_rect = PhysicalRect::new(60.0, 12.0, 90.0, 16.0);
    // 待对齐物：医院院徽 Logo (高度=20.0mm)
    let logo_height = 20.0;

    let solved_logo_y = ObstacleLayoutSolver::solve_vertical_center(&title_rect, logo_height, 0.0);
    // Logo 垂直居中后的 Y 应为 20.0 - 10.0 = 10.0mm
    assert_eq!(solved_logo_y, 10.0, "Logo 应与标题中心线完美对齐！");
}

#[test]
fn test_obstacle_aware_snaking_flow_zero_collision() {
    // 1. 构造 32 项化验单项目
    let items: Vec<LabItemRow> = (1..=32)
        .map(|i| LabItemRow {
            index: i,
            item_name: format!("化验项目_{}", i),
            item_abbr: format!("TEST_{}", i),
            result_value: "12.5".to_string(),
            unit: "mmol/L".to_string(),
            ref_range_display: "3.5~6.0".to_string(),
            alert_flag: AlertFlag::Normal,
            is_critical: false,
        })
        .collect();

    // 2. 声明位于右侧的 TEG 血栓弹力图障碍物
    let teg_obstacle = ObstacleBox {
        id: "teg_curve_chart".to_string(),
        rect: PhysicalRect::new(125.0, 48.0, 75.0, 45.0),
        padding_mm: 3.0,
    };
    let obstacle_bounding = teg_obstacle.bounding_box();

    let paper_size = PhysicalSize::a5_landscape();
    let margins = Margins {
        top: PhysicalLength::from_mm(8.0),
        bottom: PhysicalLength::from_mm(8.0),
        left: PhysicalLength::from_mm(10.0),
        right: PhysicalLength::from_mm(10.0),
    };

    // 3. 执行空间障碍避让求解
    let solved_pages = ObstacleLayoutSolver::solve_snaking_avoid_obstacles(
        &items,
        paper_size,
        margins,
        38.0,
        138.0,
        &[teg_obstacle],
        true,
    );

    assert_eq!(solved_pages.len(), 1);
    let page = &solved_pages[0];
    assert!(!page.cells.is_empty(), "必须解算生成表格行单元格！");

    // 4. 关键断言：遍历所有生成的单元格，严格不得与障碍物禁区发生任何几何碰撞！
    for cell in &page.cells {
        let collides = cell.rect.intersects(&obstacle_bounding);
        assert!(
            !collides,
            "单元格 {} (X:{}, Y:{}) 与图表障碍物禁区发生了空间碰撞！",
            cell.item.item_abbr, cell.rect.x, cell.rect.y
        );
    }

    println!("✅ 成功验证：32 项化验单在存在右侧 TEG 图表的情况下，实现 100% 空间避让零碰撞折流！");
}

#[test]
fn test_single_page_hard_constraint_compaction() {
    // 构造大量项目 (36 项)
    let items: Vec<LabItemRow> = (1..=36)
        .map(|i| LabItemRow {
            index: i,
            item_name: format!("指标_{}", i),
            item_abbr: format!("ITEM_{}", i),
            result_value: "8.8".to_string(),
            unit: "umol/L".to_string(),
            ref_range_display: "2~10".to_string(),
            alert_flag: AlertFlag::Normal,
            is_critical: false,
        })
        .collect();

    let teg_obstacle = ObstacleBox {
        id: "teg_chart".to_string(),
        rect: PhysicalRect::new(130.0, 50.0, 70.0, 40.0),
        padding_mm: 2.0,
    };

    let paper_size = PhysicalSize::a5_landscape();
    let margins = Margins {
        top: PhysicalLength::from_mm(8.0),
        bottom: PhysicalLength::from_mm(8.0),
        left: PhysicalLength::from_mm(10.0),
        right: PhysicalLength::from_mm(10.0),
    };

    let solved_pages = ObstacleLayoutSolver::solve_snaking_avoid_obstacles(
        &items,
        paper_size,
        margins,
        36.0,
        136.0,
        &[teg_obstacle],
        true, // 开启单页锁定
    );

    assert_eq!(solved_pages.len(), 1);
    let page = &solved_pages[0];
    // 行高必须发生自适应弹性压缩 (小于标准 5.5mm，但在可读性底线 >= 4.4mm 之上)
    assert!(page.effective_row_height_mm < 5.5);
    assert!(page.effective_row_height_mm >= 4.4);
}
